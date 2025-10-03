import { NextResponse } from "next/server";
import {
  signalWorkflow,
  resolveSecretAlias,
  SecretAliasResolutionError
} from "@airnub/orchestrator-temporal";

import {
  assertUniqueNonce,
  NonceReplayError,
  SignatureVerificationError,
  verifySignature
} from "../../_lib/security";
import { resolveChannelConfig } from "../../_lib/channels";
import { annotateSpan, extractRunMetadataFromHeaders, setHttpAttributes, withTelemetrySpan } from "@airnub/utils/telemetry";

const ROUTE = "/api/hooks/[tenantId]/[channel]";

function safeJsonParse(payload: string): unknown {
  if (!payload) {
    return null;
  }
  try {
    return JSON.parse(payload);
  } catch (error) {
    throw new Error("Invalid JSON payload");
  }
}

function pickHeaders(headers: Headers): Record<string, string> {
  const allowList = ["content-type", "user-agent", "x-fc-signature", "x-fc-nonce"];
  const collected: Record<string, string> = {};
  for (const key of allowList) {
    const value = headers.get(key);
    if (value) {
      collected[key] = value;
    }
  }
  return collected;
}

export async function POST(
  request: Request,
  context: { params: { tenantId: string; channel: string } }
) {
  const { tenantId, channel } = context.params;
  const headerMetadata = extractRunMetadataFromHeaders(request.headers);

  return withTelemetrySpan(`POST ${ROUTE}`, {
    runId: headerMetadata.runId,
    stepId: headerMetadata.stepId,
    attributes: {
      "http.request.method": "POST",
      "http.route": ROUTE
    },
    orgId: tenantId,
    tenantId: headerMetadata.tenantId ?? tenantId,
    partnerOrgId: headerMetadata.partnerOrgId
  }, async (span) => {
    const config = resolveChannelConfig(tenantId, channel);

    if (!config) {
      const response = NextResponse.json(
        { ok: false, error: "Unknown tenant/channel" },
        { status: 404 }
      );
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    annotateSpan(span, {
      tenantId,
      attributes: {
        "freshcomply.channel": channel
      }
    });

    const rawBody = await request.text();
    let body: unknown;
    try {
      body = safeJsonParse(rawBody);
    } catch (error) {
      const response = NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    if (!body || typeof body !== "object") {
      const response = NextResponse.json({ ok: false, error: "Payload must be a JSON object" }, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    const workflowId = (body as Record<string, unknown>).workflowId;
    if (typeof workflowId !== "string" || workflowId.length === 0) {
      const response = NextResponse.json({ ok: false, error: "workflowId is required" }, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    annotateSpan(span, {
      tenantId,
      attributes: {
        "freshcomply.workflow_id": workflowId,
        "freshcomply.signal": config.signal ?? "receivedCallback"
      }
    });

    const signalName = config.signal ?? "receivedCallback";

    let verification: { timestamp: number; version: string } | undefined;
    const nonceHeader = request.headers.get("x-fc-nonce") ?? "";
    const signatureHeader = request.headers.get("x-fc-signature") ?? "";

    if (config.signatureSecretAlias) {
      if (!nonceHeader) {
        const response = NextResponse.json({ ok: false, error: "Missing nonce header" }, { status: 400 });
        setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
        return response;
      }
      if (!signatureHeader) {
        const response = NextResponse.json({ ok: false, error: "Missing signature header" }, { status: 400 });
        setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
        return response;
      }

      try {
        const secret = resolveSecretAlias(tenantId, config.signatureSecretAlias);
        const verified = verifySignature({
          secret,
          signatureHeader,
          nonce: nonceHeader,
          payload: rawBody,
          toleranceSeconds: config.toleranceSeconds
        });
        verification = { timestamp: verified.timestamp, version: verified.version };
        assertUniqueNonce(`${tenantId}:${channel}`, nonceHeader, config.nonceTtlSeconds);
      } catch (error) {
        if (error instanceof SecretAliasResolutionError) {
          const response = NextResponse.json(
            { ok: false, error: "Unable to resolve secret alias" },
            { status: 503 }
          );
          setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
          return response;
        }
        if (error instanceof SignatureVerificationError) {
          const response = NextResponse.json({ ok: false, error: error.message }, { status: 401 });
          setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
          return response;
        }
        if (error instanceof NonceReplayError) {
          const response = NextResponse.json({ ok: false, error: error.message }, { status: 409 });
          setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
          return response;
        }
        const response = NextResponse.json({ ok: false, error: "Unable to verify request" }, { status: 500 });
        setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
        return response;
      }
    }

    try {
      const signalResult = await signalWorkflow({
        tenantId,
        workflowId,
        signal: signalName,
        payload: {
          tenantId,
          channel,
          nonce: nonceHeader || null,
          verification,
          headers: pickHeaders(request.headers),
          payload: body,
          receivedAt: new Date().toISOString()
        }
      });

      const response = NextResponse.json({
        ok: true,
        status: signalResult.status,
        result: signalResult.result
      });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    } catch (error) {
      console.error("[hooks] Failed to signal workflow", error);
      const response = NextResponse.json({ ok: false, error: "Failed to dispatch signal" }, { status: 502 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }
  });
}
