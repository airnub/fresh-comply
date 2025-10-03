import { annotateSuccess, recordSpanError, withSpan } from "@airnub/utils";
import { NextResponse } from "next/server";
import { listFundingOpportunities } from "../../../server/funding";
import { SupabaseConfigurationError } from "../../../server/supabase";

export async function GET(request: Request) {
  return withSpan(
    "portal.api.funding.list",
    { attributes: { "http.method": request.method, "http.route": "/api/funding" } },
    async (span) => {
      const url = new URL(request.url);
      const search = url.searchParams.get("search") ?? undefined;
      const domain = url.searchParams.get("domain") ?? undefined;
      const county = url.searchParams.get("county") ?? undefined;
      const callYearParam = url.searchParams.get("callYear");
      const limitParam = url.searchParams.get("limit");

      const callYear = callYearParam ? Number.parseInt(callYearParam, 10) : undefined;
      const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

      const filters: Record<string, string | number> = {};
      if (search) filters["freshcomply.funding.search"] = search;
      if (domain) filters["freshcomply.funding.domain"] = domain;
      if (county) filters["freshcomply.funding.county"] = county;
      if (Number.isFinite(callYear)) filters["freshcomply.funding.callYear"] = callYear!;
      if (Number.isFinite(limit)) filters["freshcomply.funding.limit"] = limit!;
      if (Object.keys(filters).length > 0) {
        span.setAttributes(filters);
      }

      try {
        const results = await listFundingOpportunities({
          search,
          domain,
          county,
          callYear: Number.isFinite(callYear) ? callYear : undefined,
          limit: Number.isFinite(limit) ? limit : undefined
        });

        const response = NextResponse.json({ ok: true, ...results });
        span.setAttributes({ "http.status_code": response.status, "freshcomply.funding.count": results.opportunities.length });
        annotateSuccess(span);
        return response;
      } catch (error) {
        if (error instanceof SupabaseConfigurationError) {
          span.setAttributes({ "http.status_code": 503, "freshcomply.error": "supabase_configuration" });
          recordSpanError(span, error);
          return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
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
