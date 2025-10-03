import { NextResponse } from "next/server";
import { SUPPORTED_WORKFLOWS, startStepWorkflow, type SupportedWorkflow } from "@airnub/orchestrator-temporal";
import { annotateSpan, extractRunMetadataFromHeaders, setHttpAttributes, withTelemetrySpan } from "@airnub/utils/telemetry";

const ROUTE = "/api/orchestration/start";

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

    const { orgId, runId, stepKey, workflow, input, subjectOrgId, environment } = body as Record<string, unknown>;

    if (typeof orgId !== "string" || typeof runId !== "string" || typeof stepKey !== "string") {
      const response = NextResponse.json({ ok: false, error: "orgId, runId, and stepKey are required" }, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    if (typeof workflow !== "string") {
      const response = NextResponse.json({ ok: false, error: "workflow is required" }, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    if (!SUPPORTED_WORKFLOWS.includes(workflow as SupportedWorkflow)) {
      const response = NextResponse.json({ ok: false, error: "Unsupported workflow" }, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    annotateSpan(span, {
      runId,
      stepId: stepKey,
      workflow,
      orgId
    });

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

      const response = NextResponse.json({ ok: true, workflowId: result.workflowId, runId: result.runId });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    } catch (error) {
      console.error("Failed to start workflow", error);
      const response = NextResponse.json({ ok: false, error: "Unable to start workflow" }, { status: 500 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }
  });
}
