import { NextResponse } from "next/server";
import { SUPPORTED_WORKFLOWS, startStepWorkflow, type SupportedWorkflow } from "@airnub/orchestrator-temporal";

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

  const { orgId, runId, stepKey, workflow, input, subjectOrgId, environment } = body as Record<string, unknown>;

  if (typeof orgId !== "string" || typeof runId !== "string" || typeof stepKey !== "string") {
    return NextResponse.json({ ok: false, error: "orgId, runId, and stepKey are required" }, { status: 400 });
  }

  if (typeof workflow !== "string") {
    return NextResponse.json({ ok: false, error: "workflow is required" }, { status: 400 });
  }

  if (!SUPPORTED_WORKFLOWS.includes(workflow as SupportedWorkflow)) {
    return NextResponse.json({ ok: false, error: "Unsupported workflow" }, { status: 400 });
  }

  try {
    const result = await startStepWorkflow({
      workflow: workflow as SupportedWorkflow,
      orgId,
      runId,
      stepKey,
      payload: input,
      searchAttributes: {
        subjectOrg: typeof subjectOrgId === "string" ? subjectOrgId : orgId,
        environment: typeof environment === "string" ? environment : undefined
      }
    });

    return NextResponse.json({ ok: true, workflowId: result.workflowId, runId: result.runId });
  } catch (error) {
    console.error("Failed to start workflow", error);
    return NextResponse.json({ ok: false, error: "Unable to start workflow" }, { status: 500 });
  }
}
