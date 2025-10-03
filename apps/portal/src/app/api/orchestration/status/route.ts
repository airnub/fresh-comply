import { annotateSuccess, buildRunAttributes, recordSpanError, withSpan } from "@airnub/utils";
import { NextResponse } from "next/server";
import { queryWorkflowStatus } from "@airnub/orchestrator-temporal";

export async function GET(request: Request) {
  return withSpan(
    "portal.api.orchestration.status",
    { attributes: { "http.method": request.method, "http.route": "/api/orchestration/status" } },
    async (span) => {
      const url = new URL(request.url);
      const workflowId = url.searchParams.get("workflowId");

      if (!workflowId) {
        span.setAttributes({ "http.status_code": 400, "freshcomply.validation": "missing_workflowId" });
        return NextResponse.json({ ok: false, error: "workflowId is required" }, { status: 400 });
      }

      span.setAttributes(buildRunAttributes({ workflowId }));

      try {
        const result = await queryWorkflowStatus(workflowId);
        const status = 200;
        span.setAttributes({ "http.status_code": status, "freshcomply.status": `${result.status}` });
        annotateSuccess(span);
        return NextResponse.json({ ok: true, status: result.status, result: result.result }, { status });
      } catch (error) {
        recordSpanError(span, error);
        span.setAttributes({ "http.status_code": 500 });
        console.error("Failed to query workflow", error);
        return NextResponse.json({ ok: false, error: "Unable to query workflow" }, { status: 500 });
      }
    }
  );
}
