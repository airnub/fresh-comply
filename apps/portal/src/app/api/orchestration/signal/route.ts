import { annotateSuccess, buildRunAttributes, recordSpanError, withSpan } from "@airnub/utils";
import { NextResponse } from "next/server";
import { signalWorkflow } from "@airnub/orchestrator-temporal";

export async function POST(request: Request) {
  return withSpan(
    "portal.api.orchestration.signal",
    { attributes: { "http.method": "POST", "http.route": "/api/orchestration/signal" } },
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

      const { workflowId, signal, payload } = body as Record<string, unknown>;

      if (typeof workflowId !== "string" || typeof signal !== "string") {
        span.setAttributes({ "http.status_code": 400, "freshcomply.validation": "missing_parameters" });
        return NextResponse.json({ ok: false, error: "workflowId and signal are required" }, { status: 400 });
      }

      span.setAttributes({
        ...buildRunAttributes({ workflowId }),
        "freshcomply.signal": signal
      });

      try {
        const result = await signalWorkflow({
          workflowId,
          signal,
          payload
        });

        const status = 200;
        span.setAttributes({ "http.status_code": status, "freshcomply.signal.status": `${result.status}` });
        annotateSuccess(span);
        return NextResponse.json({ ok: true, status: result.status, result: result.result }, { status });
      } catch (error) {
        recordSpanError(span, error);
        span.setAttributes({ "http.status_code": 500 });
        console.error("Failed to signal workflow", error);
        return NextResponse.json({ ok: false, error: "Unable to send signal" }, { status: 500 });
      }
    }
  );
}
