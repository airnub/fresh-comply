import { NextResponse } from "next/server";
import { reverifyRule } from "../../../../lib/demo-data";
import { extractRunMetadataFromHeaders, setHttpAttributes, withTelemetrySpan } from "@airnub/utils/telemetry";

const ROUTE = "/api/reverify";

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
    const body = await request.json().catch(() => ({}));
    const ruleId = body.ruleId as string | undefined;
    if (!ruleId) {
      const response = NextResponse.json({ ok: false, error: "ruleId required" }, { status: 400 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }
    const result = await reverifyRule(ruleId);
    if (!result) {
      const response = NextResponse.json({ ok: false, error: "rule not found" }, { status: 404 });
      setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
      return response;
    }
    const response = NextResponse.json({ ok: true, rule: result });
    setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
    return response;
  });
}
