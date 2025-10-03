import { annotateSuccess, recordSpanError, withSpan } from "@airnub/utils";
import { NextResponse } from "next/server";
import { reverifyRule } from "../../../../lib/demo-data";

export async function POST(request: Request) {
  return withSpan(
    "portal.api.reverify.rule",
    { attributes: { "http.method": request.method, "http.route": "/api/reverify" } },
    async (span) => {
      const body = await request.json().catch(() => ({}));
      const ruleId = body.ruleId as string | undefined;
      if (!ruleId) {
        span.setAttributes({ "http.status_code": 400, "freshcomply.validation": "missing_ruleId" });
        return NextResponse.json({ ok: false, error: "ruleId required" }, { status: 400 });
      }

      span.setAttributes({ "freshcomply.ruleId": ruleId });

      try {
        const result = await reverifyRule(ruleId);
        if (!result) {
          span.setAttributes({ "http.status_code": 404, "freshcomply.validation": "rule_not_found" });
          return NextResponse.json({ ok: false, error: "rule not found" }, { status: 404 });
        }
        const response = NextResponse.json({ ok: true, rule: result });
        span.setAttributes({ "http.status_code": response.status });
        annotateSuccess(span);
        return response;
      } catch (error) {
        recordSpanError(span, error);
        span.setAttributes({ "http.status_code": 500 });
        return NextResponse.json({ ok: false, error: "Unable to reverify rule" }, { status: 500 });
      }
    }
  );
}
