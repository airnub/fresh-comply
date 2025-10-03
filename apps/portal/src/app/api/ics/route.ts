import { annotateSuccess, withSpan } from "@airnub/utils";
import { NextResponse } from "next/server";
import { buildICS } from "@airnub/utils/ics";

export async function GET() {
  return withSpan(
    "portal.api.ics.demo",
    { attributes: { "http.method": "GET", "http.route": "/api/ics" } },
    async (span) => {
      const ics = buildICS({
        summary: "Demo Deadline",
        start: new Date("2025-10-15T09:00:00Z"),
        end: new Date("2025-10-15T10:00:00Z")
      });
      const response = new NextResponse(ics, { headers: { "Content-Type": "text/calendar" } });
      span.setAttributes({ "http.status_code": response.status });
      annotateSuccess(span);
      return response;
    }
  );
}
