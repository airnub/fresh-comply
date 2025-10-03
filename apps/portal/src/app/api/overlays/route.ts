import { annotateSuccess, recordSpanError, withSpan } from "@airnub/utils";
import { NextResponse } from "next/server";
import {
  getSupabaseClient,
  SupabaseConfigurationError,
} from "../../../server/supabase";

export async function POST(request: Request) {
  return withSpan(
    "portal.api.overlays.snapshot",
    { attributes: { "http.method": request.method, "http.route": "/api/overlays" } },
    async (span) => {
      let payload: unknown;
      try {
        payload = await request.json();
      } catch (error) {
        span.setAttributes({ "http.status_code": 400, "freshcomply.validation": "invalid_json" });
        return NextResponse.json(
          { ok: false, error: "Invalid JSON payload" },
          { status: 400 }
        );
      }

      if (!payload || typeof payload !== "object") {
        span.setAttributes({ "http.status_code": 400, "freshcomply.validation": "non_object_body" });
        return NextResponse.json(
          { ok: false, error: "Request body must be an object" },
          { status: 400 }
        );
      }

      const { tenantId, workflowId, overlay, mergedWorkflow } = payload as {
        tenantId?: string;
        workflowId?: string;
        overlay?: unknown;
        mergedWorkflow?: unknown;
      };

      if (!tenantId || !workflowId || !Array.isArray(overlay) || !mergedWorkflow) {
        span.setAttributes({ "http.status_code": 400, "freshcomply.validation": "missing_fields" });
        return NextResponse.json(
          { ok: false, error: "Missing tenantId, workflowId, overlay, or mergedWorkflow" },
          { status: 400 }
        );
      }

      span.setAttributes({
        "freshcomply.tenantId": tenantId,
        "freshcomply.workflowId": workflowId,
        "freshcomply.overlays.count": Array.isArray(overlay) ? overlay.length : 0
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
          recordSpanError(span, error);
          span.setAttributes({ "http.status_code": 500, "freshcomply.error": "overlay_insert_failed" });
          return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
          );
        }

        const response = NextResponse.json({ ok: true });
        span.setAttributes({ "http.status_code": response.status });
        annotateSuccess(span);
        return response;
      } catch (error) {
        if (error instanceof SupabaseConfigurationError) {
          recordSpanError(span, error);
          span.setAttributes({ "http.status_code": 503, "freshcomply.error": "supabase_configuration" });
          return NextResponse.json(
            { ok: false, error: error.message },
            { status: 503 }
          );
        }
        recordSpanError(span, error);
        span.setAttributes({ "http.status_code": 500 });
        return NextResponse.json(
          { ok: false, error: (error as Error).message },
          { status: 500 }
        );
      }
    }
  );
}
