import { createHash, createHmac } from "node:crypto";
import {
  resolveSecretAlias,
  SecretAliasResolutionError
} from "@airnub/orchestrator-temporal";
import {
  annotateSpan,
  extractRunMetadataFromHeaders,
  setHttpAttributes,
  withTelemetrySpan
} from "@airnub/utils/telemetry";

function jsonResponse(body: Record<string, unknown>, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return new Response(JSON.stringify(body), {
    ...init,
    headers
  });
}

const ROUTE = "/api/orchestration/webhook";
const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"] as const);

type HttpMethod = typeof HTTP_METHODS extends Set<infer T> ? T : never;

type WebhookConfig = {
  method: HttpMethod;
  urlAlias: string;
  tokenAlias?: string;
  path?: string;
  headers?: Record<string, string>;
  body?: unknown;
  signing?: { algo: "hmac-sha256"; secretAlias: string };
};

function isMethod(value: unknown): value is HttpMethod {
  return typeof value === "string" && HTTP_METHODS.has(value as never);
}

function isAlias(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !value.includes("://");
}

function buildUrl(baseUrl: string, path?: string): string {
  if (!path) {
    return baseUrl;
  }
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const trimmedPath = path.startsWith("/") ? path.slice(1) : path;
  return new URL(trimmedPath, base).toString();
}

function hashPayload(payload?: string): string {
  const hash = createHash("sha256");
  hash.update(payload ?? "");
  return hash.digest("hex");
}

export async function POST(request: Request) {
  const headerMetadata = extractRunMetadataFromHeaders(request.headers);

  return withTelemetrySpan(`POST ${ROUTE}`, {
    runId: headerMetadata.runId,
    stepId: headerMetadata.stepId,
    attributes: {
      "http.request.method": "POST",
      "http.route": ROUTE
    }
  }, async (span) => {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch (error) {
      const response = jsonResponse({ ok: false, error: "Invalid JSON body" }, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    if (!payload || typeof payload !== "object") {
      const response = jsonResponse({ ok: false, error: "Body must be an object" }, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    const { tenantId, runId, stepKey, orgId, request: webhookRequest } = payload as Record<string, unknown>;

    if (typeof tenantId !== "string" || tenantId.length === 0) {
      const response = jsonResponse({ ok: false, error: "tenantId is required" }, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    if (!webhookRequest || typeof webhookRequest !== "object") {
      const response = jsonResponse({ ok: false, error: "request config is required" }, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    const { method, urlAlias, tokenAlias, path: requestPath, headers, body, signing } =
      webhookRequest as WebhookConfig;

    if (!isMethod(method)) {
      const response = jsonResponse({ ok: false, error: "Unsupported HTTP method" }, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    if (!isAlias(urlAlias)) {
      const response = jsonResponse({ ok: false, error: "urlAlias must reference a secret alias" }, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    if (tokenAlias && !isAlias(tokenAlias)) {
      const response = jsonResponse({ ok: false, error: "tokenAlias must reference a secret alias" }, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    if (signing && signing.algo !== "hmac-sha256") {
      const response = jsonResponse({ ok: false, error: "Unsupported signing algorithm" }, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    if (signing && !isAlias(signing.secretAlias)) {
      const response = jsonResponse({ ok: false, error: "signing.secretAlias must reference a secret alias" }, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    annotateSpan(span, {
      runId: typeof runId === "string" ? runId : undefined,
      stepId: typeof stepKey === "string" ? stepKey : undefined,
      orgId: typeof orgId === "string" ? orgId : tenantId,
      attributes: {
        "freshcomply.webhook.url_alias": urlAlias
      }
    });

    let baseUrl: string;
    let token: string | undefined;
    let signingSecret: string | undefined;
    try {
      baseUrl = resolveSecretAlias(tenantId, urlAlias);
      token = tokenAlias ? resolveSecretAlias(tenantId, tokenAlias) : undefined;
      signingSecret = signing ? resolveSecretAlias(tenantId, signing.secretAlias) : undefined;
    } catch (error) {
      if (error instanceof SecretAliasResolutionError) {
        const response = jsonResponse({ ok: false, error: "Unable to resolve secret alias" }, { status: 503 });
        setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
        return response;
      }
      const response = jsonResponse({ ok: false, error: "Unexpected error resolving aliases" }, { status: 500 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    const url = buildUrl(baseUrl, requestPath);
    const requestHeaders = new Headers();
    requestHeaders.set("User-Agent", "fresh-comply-portal/1.0");
    const idempotencyKey = `${tenantId}:${runId ?? ""}:${stepKey ?? ""}:${Date.now()}`;
    requestHeaders.set("X-FC-Idempotency-Key", idempotencyKey);
    if (typeof runId === "string") {
      requestHeaders.set("X-FC-Run-Id", runId);
    }
    if (typeof stepKey === "string") {
      requestHeaders.set("X-FC-Step-Key", stepKey);
    }

    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        requestHeaders.set(key, value);
      }
    }

    let bodyString: string | undefined;
    if (body !== undefined && body !== null) {
      bodyString = typeof body === "string" ? body : JSON.stringify(body);
      if (!requestHeaders.has("Content-Type")) {
        requestHeaders.set("Content-Type", "application/json");
      }
    }

    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }

    if (signingSecret && bodyString) {
      const signature = createHmac("sha256", signingSecret).update(bodyString).digest("hex");
      requestHeaders.set("X-FC-Signature", signature);
    }

    let response: globalThis.Response;
    try {
      response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: bodyString
      });
    } catch (error) {
      console.error("[webhook] Failed to invoke endpoint", error);
      const failure = jsonResponse({ ok: false, error: "Failed to invoke webhook" }, { status: 502 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: failure.status });
      return failure;
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });
    const bodyText = await response.text();
    const responseHash = hashPayload(bodyText);

    annotateSpan(span, {
      attributes: {
        "http.response.status_code": response.status,
        "freshcomply.http.url": url,
        "freshcomply.http.response_hash": responseHash
      }
    });

    if (!response.ok) {
      const failure = jsonResponse(
        {
          ok: false,
          error: `Webhook request failed with status ${response.status}`,
          status: response.status,
          responseHash
        },
        { status: 502 }
      );
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: failure.status });
      return failure;
    }

    const success = jsonResponse({
      ok: true,
      status: response.status,
      requestHash: hashPayload(bodyString),
      responseHash,
      headers: responseHeaders,
      bodyPreview: bodyText.slice(0, 512)
    });
    setHttpAttributes(span, { method: "POST", route: ROUTE, status: success.status });
    return success;
  });
}
