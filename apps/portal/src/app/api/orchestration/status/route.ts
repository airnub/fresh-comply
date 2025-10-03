import { NextResponse } from "next/server";
import { queryWorkflowStatus } from "@airnub/orchestrator-temporal";
import { annotateSpan, extractRunMetadataFromHeaders, setHttpAttributes, withTelemetrySpan } from "@airnub/utils/telemetry";

const ROUTE = "/api/orchestration/status";

export async function GET(request: Request) {
  const headerMetadata = extractRunMetadataFromHeaders(request.headers);

  return withTelemetrySpan(`GET ${ROUTE}`, {
    runId: headerMetadata.runId,
    stepId: headerMetadata.stepId,
    attributes: {
      "http.request.method": "GET",
      "http.route": ROUTE
    }
  }, async (span) => {
    const url = new URL(request.url);
    const workflowId = url.searchParams.get("workflowId");

    if (!workflowId) {
      const response = NextResponse.json({ ok: false, error: "workflowId is required" }, { status: 400 });
      setHttpAttributes(span, { method: "GET", route: ROUTE, status: response.status });
      return response;
    }

    annotateSpan(span, {
      attributes: {
        "freshcomply.workflow_id": workflowId
      }
    });

    try {
      const result = await queryWorkflowStatus(workflowId);
      const response = NextResponse.json({ ok: true, status: result.status, result: result.result });
      setHttpAttributes(span, { method: "GET", route: ROUTE, status: response.status });
      return response;
    } catch (error) {
      console.error("Failed to query workflow", error);
      const response = NextResponse.json({ ok: false, error: "Unable to query workflow" }, { status: 500 });
      setHttpAttributes(span, { method: "GET", route: ROUTE, status: response.status });
      return response;
    }
  });
}
