import { NextResponse } from "next/server";
import { queryWorkflowStatus } from "@airnub/orchestrator-temporal";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workflowId = url.searchParams.get("workflowId");

  if (!workflowId) {
    return NextResponse.json({ ok: false, error: "workflowId is required" }, { status: 400 });
  }

  try {
    const result = await queryWorkflowStatus(workflowId);
    return NextResponse.json({ ok: true, status: result.status, result: result.result });
  } catch (error) {
    console.error("Failed to query workflow", error);
    return NextResponse.json({ ok: false, error: "Unable to query workflow" }, { status: 500 });
  }
}
