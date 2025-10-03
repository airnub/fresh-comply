import { createHash, createHmac } from "node:crypto";
import { fetch, Headers, Response } from "undici";
import { resolveSecretAlias } from "../secrets.js";
import type { StepActivityContext } from "./util.js";
import { annotateSpan, withTelemetrySpan } from "@airnub/utils/telemetry";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpRequestConfig {
  method: HttpMethod;
  urlAlias: string;
  path?: string;
  tokenAlias?: string;
  headers?: Record<string, string>;
  signingSecretAlias?: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

export interface HttpExecutionContext {
  tenantId: string;
  context: StepActivityContext;
  request: HttpRequestConfig;
  idempotencyKey?: string;
}

export interface HttpExecutionResult {
  ok: boolean;
  status: number;
  requestHash: string;
  responseHash?: string;
  headers: Record<string, string>;
  bodyText?: string;
  body?: unknown;
}

function buildUrl(baseUrl: string, path?: string, query?: HttpRequestConfig["query"]): string {
  const url = new URL(path ?? "", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function hashPayload(payload?: string): string {
  const hash = createHash("sha256");
  hash.update(payload ?? "");
  return hash.digest("hex");
}

async function parseBody(response: Response): Promise<{ bodyText?: string; body?: unknown }> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (!text) {
    return {};
  }

  if (contentType.includes("application/json")) {
    try {
      return { bodyText: text, body: JSON.parse(text) };
    } catch (error) {
      console.warn("[http-activity] Unable to parse JSON response", error);
      return { bodyText: text };
    }
  }

  return { bodyText: text };
}

export async function performSignedHttpRequest(options: HttpExecutionContext): Promise<HttpExecutionResult> {
  return withTelemetrySpan("temporal.activity.performSignedHttpRequest", {
    runId: options.context.runId,
    stepId: options.context.stepKey,
    orgId: options.context.orgId,
    attributes: {
      "freshcomply.temporal.activity": "performSignedHttpRequest",
      "freshcomply.http.method": options.request.method,
      "freshcomply.http.url_alias": options.request.urlAlias,
      "freshcomply.tenant_id": options.tenantId,
      "http.request.method": options.request.method
    }
  }, async (span) => {
    const { tenantId, context, request, idempotencyKey } = options;
    const baseUrl = resolveSecretAlias(tenantId, request.urlAlias);
    const token = request.tokenAlias ? resolveSecretAlias(tenantId, request.tokenAlias) : undefined;
    const signingSecret = request.signingSecretAlias
      ? resolveSecretAlias(tenantId, request.signingSecretAlias)
      : undefined;

    const url = buildUrl(baseUrl, request.path, request.query);
    span.setAttribute("http.url", url);
    const headers = new Headers();
    headers.set("User-Agent", "fresh-comply-temporal/1.0");
    headers.set("X-FC-Idempotency-Key", idempotencyKey ?? `${context.runId}:${context.stepKey}`);
    headers.set("X-FC-Run-Id", context.runId);
    headers.set("X-FC-Step-Key", context.stepKey);

    for (const [key, value] of Object.entries(request.headers ?? {})) {
      headers.set(key, value);
    }

    let bodyString: string | undefined;
    if (request.body !== undefined && request.body !== null) {
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      bodyString = typeof request.body === "string" ? request.body : JSON.stringify(request.body);
    }

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (signingSecret && bodyString) {
      const signature = createHmac("sha256", signingSecret).update(bodyString).digest("hex");
      headers.set("X-FC-Signature", signature);
    }

    const response = await fetch(url, {
      method: request.method,
      headers,
      body: bodyString
    });

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });

    const { bodyText, body } = await parseBody(response);

    const result: HttpExecutionResult = {
      ok: response.ok,
      status: response.status,
      requestHash: hashPayload(bodyString),
      responseHash: hashPayload(bodyText),
      headers: responseHeaders,
      bodyText,
      body
    };

    annotateSpan(span, {
      attributes: {
        "http.response.status_code": response.status,
        "freshcomply.http.request_hash": result.requestHash,
        "freshcomply.http.response_hash": result.responseHash ?? ""
      }
    });

    if (!response.ok) {
      const error = new Error(
        `HTTP request failed with status ${response.status}: ${bodyText ?? response.statusText}`
      );
      (error as Error & { metadata?: unknown }).metadata = {
        status: response.status,
        url,
        headers: responseHeaders,
        responseHash: result.responseHash
      };
      throw error;
    }

    return result;
  });
}
