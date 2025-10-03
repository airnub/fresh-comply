import { NextResponse } from "next/server";
import { signalWorkflow } from "@airnub/orchestrator-temporal";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Body must be an object" }, { status: 400 });
  }

  const { workflowId, signal, payload } = body as Record<string, unknown>;

  if (typeof workflowId !== "string" || typeof signal !== "string") {
    return NextResponse.json({ ok: false, error: "workflowId and signal are required" }, { status: 400 });
  }

  try {
    const result = await signalWorkflow({
      workflowId,
      signal,
      payload
    });

    return NextResponse.json({ ok: true, status: result.status, result: result.result });
  } catch (error) {
    console.error("Failed to signal workflow", error);
    return NextResponse.json({ ok: false, error: "Unable to send signal" }, { status: 500 });
  }
}
