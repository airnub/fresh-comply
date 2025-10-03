import { NextResponse } from "next/server";
import { listFundingOpportunities } from "../../../server/funding";
import { SupabaseConfigurationError } from "../../../server/supabase";
import { extractRunMetadataFromHeaders, setHttpAttributes, withTelemetrySpan } from "@airnub/utils/telemetry";

const ROUTE = "/api/funding";

export async function GET(request: Request) {
  const headerMetadata = extractRunMetadataFromHeaders(request.headers);

  return withTelemetrySpan(`GET ${ROUTE}`, {
    runId: headerMetadata.runId,
    stepId: headerMetadata.stepId,
    tenantId: headerMetadata.tenantId,
    partnerOrgId: headerMetadata.partnerOrgId,
    attributes: {
      "http.request.method": "GET",
      "http.route": ROUTE
    }
  }, async (span) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? undefined;
    const domain = url.searchParams.get("domain") ?? undefined;
    const county = url.searchParams.get("county") ?? undefined;
    const callYearParam = url.searchParams.get("callYear");
    const limitParam = url.searchParams.get("limit");

    const callYear = callYearParam ? Number.parseInt(callYearParam, 10) : undefined;
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    try {
      const results = await listFundingOpportunities({
        search,
        domain,
        county,
        callYear: Number.isFinite(callYear) ? callYear : undefined,
        limit: Number.isFinite(limit) ? limit : undefined
      });

      const response = NextResponse.json({ ok: true, ...results });
      setHttpAttributes(span, { method: "GET", route: ROUTE, status: response.status });
      return response;
    } catch (error) {
      if (error instanceof SupabaseConfigurationError) {
        const response = NextResponse.json({ ok: false, error: error.message }, { status: 503 });
        setHttpAttributes(span, { method: "GET", route: ROUTE, status: response.status });
        return response;
      }
      const response = NextResponse.json(
        { ok: false, error: (error as Error).message },
        { status: 500 }
      );
      setHttpAttributes(span, { method: "GET", route: ROUTE, status: response.status });
      return response;
    }
  });
}
