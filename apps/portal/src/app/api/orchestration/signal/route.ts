import { NextResponse } from "next/server";
import { signalWorkflow } from "@airnub/orchestrator-temporal";
import { annotateSpan, extractRunMetadataFromHeaders, setHttpAttributes, withTelemetrySpan } from "@airnub/utils/telemetry";

const ROUTE = "/api/orchestration/signal";

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
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      const response = NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    if (!body || typeof body !== "object") {
      const response = NextResponse.json({ ok: false, error: "Body must be an object" }, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    const { tenantId, workflowId, signal, payload } = body as Record<string, unknown>;

    if (typeof tenantId !== "string" || tenantId.length === 0) {
      const response = NextResponse.json({ ok: false, error: "tenantId is required" }, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    if (typeof workflowId !== "string" || typeof signal !== "string") {
      const response = NextResponse.json({ ok: false, error: "workflowId and signal are required" }, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    annotateSpan(span, {
      attributes: {
        "freshcomply.workflow_id": workflowId,
        "freshcomply.signal": signal,
        "freshcomply.tenant_id": tenantId
      }
    });

    try {
      const result = await signalWorkflow({
        tenantId,
        workflowId,
        signal,
        payload
      });

      const response = NextResponse.json({ ok: true, status: result.status, result: result.result });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    } catch (error) {
      console.error("Failed to signal workflow", error);
      const response = NextResponse.json({ ok: false, error: "Unable to send signal" }, { status: 500 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }
  });
}
