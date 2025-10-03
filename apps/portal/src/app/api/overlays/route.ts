import { NextResponse } from "next/server";
import {
  getSupabaseClient,
  SupabaseConfigurationError,
} from "../../../server/supabase";
import { annotateSpan, extractRunMetadataFromHeaders, setHttpAttributes, withTelemetrySpan } from "@airnub/utils/telemetry";

const ROUTE = "/api/overlays";

export async function POST(request: Request) {
  const headerMetadata = extractRunMetadataFromHeaders(request.headers);

  return withTelemetrySpan(`POST ${ROUTE}`, {
    runId: headerMetadata.runId,
    stepId: headerMetadata.stepId,
    tenantId: headerMetadata.tenantId,
    partnerOrgId: headerMetadata.partnerOrgId,
    attributes: {
      "http.request.method": "POST",
      "http.route": ROUTE
    }
  }, async (span) => {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch (error) {
      const response = NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400 }
      );
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    if (!payload || typeof payload !== "object") {
      const response = NextResponse.json(
        { ok: false, error: "Request body must be an object" },
        { status: 400 }
      );
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    const { tenantId, workflowId, overlay, mergedWorkflow } = payload as {
      tenantId?: string;
      workflowId?: string;
      overlay?: unknown;
      mergedWorkflow?: unknown;
    };

    if (!tenantId || !workflowId || !Array.isArray(overlay) || !mergedWorkflow) {
      const response = NextResponse.json(
        { ok: false, error: "Missing tenantId, workflowId, overlay, or mergedWorkflow" },
        { status: 400 }
      );
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }

    annotateSpan(span, {
      orgId: tenantId,
      tenantId,
      attributes: {
        "freshcomply.workflow_id": workflowId
      }
    });

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("workflow_overlay_snapshots").insert({
        run_id: null,
        tenant_overlay_id: null,
        applied_overlays: overlay,
        merged_workflow: mergedWorkflow,
      });

      if (error) {
        const response = NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
        setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
        return response;
      }

      const response = NextResponse.json({ ok: true });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    } catch (error) {
      if (error instanceof SupabaseConfigurationError) {
        const response = NextResponse.json(
          { ok: false, error: error.message },
          { status: 503 }
        );
        setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
        return response;
      }
      const response = NextResponse.json(
        { ok: false, error: (error as Error).message },
        { status: 500 }
      );
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }
  });
}
