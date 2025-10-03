import { annotateSuccess, recordSpanError, withSpan } from "@airnub/utils";
import { NextResponse } from "next/server";
import { listFundingOpportunities } from "../../../../server/funding";
import { SupabaseConfigurationError } from "../../../../server/supabase";

function formatDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export async function GET(request: Request) {
  return withSpan(
    "portal.api.funding.calendar",
    { attributes: { "http.method": request.method, "http.route": "/api/funding/calendar" } },
    async (span) => {
      const url = new URL(request.url);
      const domain = url.searchParams.get("domain") ?? undefined;
      const county = url.searchParams.get("county") ?? undefined;
      const callYearParam = url.searchParams.get("callYear");
      const callYear = callYearParam ? Number.parseInt(callYearParam, 10) : undefined;

      const attributeMap: Record<string, string | number> = {};
      if (domain) {
        attributeMap["freshcomply.funding.domain"] = domain;
      }
      if (county) {
        attributeMap["freshcomply.funding.county"] = county;
      }
      if (Number.isFinite(callYear)) {
        attributeMap["freshcomply.funding.callYear"] = callYear!;
      }
      if (Object.keys(attributeMap).length > 0) {
        span.setAttributes(attributeMap);
      }

      try {
        const { opportunities } = await listFundingOpportunities({
          domain,
          county,
          callYear: Number.isFinite(callYear) ? callYear : undefined,
          limit: 250
        });

        const now = formatDate(new Date());
        const lines = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//FreshComply//Funding Radar//EN",
          "CALSCALE:GREGORIAN"
        ];

        for (const opportunity of opportunities) {
          const start = opportunity.call_year
            ? new Date(Date.UTC(opportunity.call_year, 0, 1))
            : new Date();
          const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
          lines.push("BEGIN:VEVENT");
          lines.push(`UID:funding-${opportunity.id}`);
          lines.push(`DTSTAMP:${now}`);
          lines.push(`DTSTART:${formatDate(start)}`);
          lines.push(`DTEND:${formatDate(end)}`);
          lines.push(`SUMMARY:${escapeText(opportunity.title)}`);
          if (opportunity.summary) {
            lines.push(`DESCRIPTION:${escapeText(opportunity.summary)}`);
          }
          if (opportunity.lead_institution) {
            lines.push(`LOCATION:${escapeText(opportunity.lead_institution)}`);
          }
          lines.push("END:VEVENT");
        }

        lines.push("END:VCALENDAR");

        const response = new NextResponse(lines.join("\r\n"), {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": "attachment; filename=funding-radar.ics"
          }
        });
        span.setAttributes({ "http.status_code": response.status, "freshcomply.funding.count": opportunities.length });
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

function escapeText(input: string) {
  return input
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
