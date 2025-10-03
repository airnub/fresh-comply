import {
  annotateSuccess,
  buildRunAttributes,
  recordSpanError,
  withSpan
} from "@airnub/utils";
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
  return withSpan(
    "portal.api.hooks.dispatch",
    { attributes: { "http.method": request.method, "http.route": "/api/hooks/[tenantId]/[channel]" } },
    async (span) => {
      const { tenantId, channel } = context.params;
      span.setAttributes({ "freshcomply.tenantId": tenantId, "freshcomply.channel": channel });

      const config = resolveChannelConfig(tenantId, channel);
      const respond = (
        status: number,
        body: Record<string, unknown>,
        attributes: Record<string, unknown> = {}
      ) => {
        span.setAttributes({ "http.status_code": status, ...attributes });
        if (status < 400) {
          annotateSuccess(span);
        }
        return NextResponse.json(body, { status });
      };

      if (!config) {
        return respond(404, { ok: false, error: "Unknown tenant/channel" }, {
          "freshcomply.validation": "unknown_channel"
        });
      }

      const rawBody = await request.text();
      let body: unknown;
      try {
        body = safeJsonParse(rawBody);
      } catch (error) {
        return respond(400, { ok: false, error: (error as Error).message }, {
          "freshcomply.validation": "invalid_json"
        });
      }

      if (!body || typeof body !== "object") {
        return respond(400, { ok: false, error: "Payload must be a JSON object" }, {
          "freshcomply.validation": "non_object_body"
        });
      }

      const workflowId = (body as Record<string, unknown>).workflowId;
      if (typeof workflowId !== "string" || workflowId.length === 0) {
        return respond(400, { ok: false, error: "workflowId is required" }, {
          "freshcomply.validation": "missing_workflowId"
        });
      }

      const signalName = config.signal ?? "receivedCallback";
      span.setAttributes({
        ...buildRunAttributes({ workflowId }),
        "freshcomply.signal": signalName
      });

      let verification: { timestamp: number; version: string } | undefined;
      const nonceHeader = request.headers.get("x-fc-nonce") ?? "";
      const signatureHeader = request.headers.get("x-fc-signature") ?? "";

      if (config.signatureSecretAlias) {
        if (!nonceHeader) {
          return respond(400, { ok: false, error: "Missing nonce header" }, {
            "freshcomply.validation": "missing_nonce"
          });
        }
        if (!signatureHeader) {
          return respond(400, { ok: false, error: "Missing signature header" }, {
            "freshcomply.validation": "missing_signature"
          });
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
            recordSpanError(span, error);
            return respond(503, { ok: false, error: "Unable to resolve secret alias" }, {
              "freshcomply.error": "secret_resolution_failed"
            });
          }
          if (error instanceof SignatureVerificationError) {
            return respond(401, { ok: false, error: error.message }, {
              "freshcomply.validation": "signature_invalid"
            });
          }
          if (error instanceof NonceReplayError) {
            return respond(409, { ok: false, error: error.message }, {
              "freshcomply.validation": "nonce_replay"
            });
          }
          recordSpanError(span, error);
          return respond(500, { ok: false, error: "Unable to verify request" }, {
            "freshcomply.error": "signature_unknown"
          });
        }
      }

      try {
        const signalResult = await signalWorkflow({
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

        return respond(
          200,
          {
            ok: true,
            status: signalResult.status,
            result: signalResult.result
          },
          { "freshcomply.signal.status": `${signalResult.status}` }
        );
      } catch (error) {
        recordSpanError(span, error);
        console.error("[hooks] Failed to signal workflow", error);
        return respond(502, { ok: false, error: "Failed to dispatch signal" }, {
          "freshcomply.error": "signal_dispatch_failed"
        });
      }
    }
  );
}
