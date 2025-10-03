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
  const { tenantId, channel } = context.params;
  const config = resolveChannelConfig(tenantId, channel);

  if (!config) {
    return NextResponse.json(
      { ok: false, error: "Unknown tenant/channel" },
      { status: 404 }
    );
  }

  const rawBody = await request.text();
  let body: unknown;
  try {
    body = safeJsonParse(rawBody);
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Payload must be a JSON object" }, { status: 400 });
  }

  const workflowId = (body as Record<string, unknown>).workflowId;
  if (typeof workflowId !== "string" || workflowId.length === 0) {
    return NextResponse.json({ ok: false, error: "workflowId is required" }, { status: 400 });
  }

  const signalName = config.signal ?? "receivedCallback";

  let verification: { timestamp: number; version: string } | undefined;
  const nonceHeader = request.headers.get("x-fc-nonce") ?? "";
  const signatureHeader = request.headers.get("x-fc-signature") ?? "";

  if (config.signatureSecretAlias) {
    if (!nonceHeader) {
      return NextResponse.json({ ok: false, error: "Missing nonce header" }, { status: 400 });
    }
    if (!signatureHeader) {
      return NextResponse.json({ ok: false, error: "Missing signature header" }, { status: 400 });
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
        return NextResponse.json(
          { ok: false, error: "Unable to resolve secret alias" },
          { status: 503 }
        );
      }
      if (error instanceof SignatureVerificationError) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
      }
      if (error instanceof NonceReplayError) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: "Unable to verify request" }, { status: 500 });
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

    return NextResponse.json({
      ok: true,
      status: signalResult.status,
      result: signalResult.result
    });
  } catch (error) {
    console.error("[hooks] Failed to signal workflow", error);
    return NextResponse.json({ ok: false, error: "Failed to dispatch signal" }, { status: 502 });
  }
}
