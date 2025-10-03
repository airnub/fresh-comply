import { NextResponse } from "next/server";
import { buildICS } from "@airnub/utils/ics";
import { extractRunMetadataFromHeaders, setHttpAttributes, withTelemetrySpan } from "@airnub/utils/telemetry";

const ROUTE = "/api/ics";

export async function GET(request: Request) {
  const headerMetadata = extractRunMetadataFromHeaders(request.headers);

  return withTelemetrySpan(`GET ${ROUTE}`, {
    runId: headerMetadata.runId,
    stepId: headerMetadata.stepId,
    attributes: {
      "http.request.method": "GET",
      "http.route": ROUTE
    }
  }, async (span) => {
    const ics = buildICS({
      summary: "Demo Deadline",
      start: new Date("2025-10-15T09:00:00Z"),
      end: new Date("2025-10-15T10:00:00Z")
    });
    const response = new NextResponse(ics, { headers: { "Content-Type": "text/calendar" } });
    setHttpAttributes(span, { method: "GET", route: ROUTE, status: response.status });
    return response;
  });
}
