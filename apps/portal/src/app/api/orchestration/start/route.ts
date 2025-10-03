import { annotateSuccess, buildRunAttributes, recordSpanError, withSpan } from "@airnub/utils";
import { NextResponse } from "next/server";
import { SUPPORTED_WORKFLOWS, startStepWorkflow, type SupportedWorkflow } from "@airnub/orchestrator-temporal";

export async function POST(request: Request) {
  return withSpan(
    "portal.api.orchestration.start",
    { attributes: { "http.method": "POST", "http.route": "/api/orchestration/start" } },
    async (span) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch (error) {
        span.setAttributes({ "http.status_code": 400, "freshcomply.validation": "invalid_json" });
        return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
      }

      if (!body || typeof body !== "object") {
        span.setAttributes({ "http.status_code": 400, "freshcomply.validation": "non_object_body" });
        return NextResponse.json({ ok: false, error: "Body must be an object" }, { status: 400 });
      }

      const { orgId, runId, stepKey, workflow, input, subjectOrgId, environment } = body as Record<string, unknown>;

      if (typeof orgId !== "string" || typeof runId !== "string" || typeof stepKey !== "string") {
        span.setAttributes({ "http.status_code": 400, "freshcomply.validation": "missing_identifiers" });
        return NextResponse.json({ ok: false, error: "orgId, runId, and stepKey are required" }, { status: 400 });
      }

      if (typeof workflow !== "string") {
        span.setAttributes({ "http.status_code": 400, "freshcomply.validation": "missing_workflow" });
        return NextResponse.json({ ok: false, error: "workflow is required" }, { status: 400 });
      }

      span.setAttributes({
        ...buildRunAttributes({ orgId, runId, stepKey }),
        "freshcomply.workflow": workflow
      });

      if (!SUPPORTED_WORKFLOWS.includes(workflow as SupportedWorkflow)) {
        span.setAttributes({ "http.status_code": 400, "freshcomply.validation": "unsupported_workflow" });
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

        span.setAttributes({ "freshcomply.workflowId": result.workflowId, "http.status_code": 200 });
        annotateSuccess(span);
        return NextResponse.json({ ok: true, workflowId: result.workflowId, runId: result.runId });
      } catch (error) {
        recordSpanError(span, error);
        span.setAttributes({ "http.status_code": 500 });
        console.error("Failed to start workflow", error);
        return NextResponse.json({ ok: false, error: "Unable to start workflow" }, { status: 500 });
      }
    }
  );
}
