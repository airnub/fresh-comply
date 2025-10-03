import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { extractRunMetadataFromHeaders, setHttpAttributes, withTelemetrySpan } from "@airnub/utils/telemetry";

const CONSENT_COOKIE = "fc_consent";
const ROUTE = "/api/consent";

export async function GET() {
  const headerMetadata = extractRunMetadataFromHeaders(headers());

  return withTelemetrySpan(`GET ${ROUTE}`, {
    runId: headerMetadata.runId,
    stepId: headerMetadata.stepId,
    attributes: {
      "http.request.method": "GET",
      "http.route": ROUTE
    }
  }, async (span) => {
    const consentCookie = cookies().get(CONSENT_COOKIE)?.value;
    let consent: unknown = null;
    if (consentCookie) {
      try {
        consent = JSON.parse(consentCookie);
      } catch {
        consent = consentCookie;
      }
    }
    const response = NextResponse.json({ consent });
    setHttpAttributes(span, { method: "GET", route: ROUTE, status: response.status });
    return response;
  });
}

export async function POST(request: NextRequest) {
  const headerMetadata = extractRunMetadataFromHeaders(request.headers);

  return withTelemetrySpan(`POST ${ROUTE}`, {
    runId: headerMetadata.runId,
    stepId: headerMetadata.stepId,
    attributes: {
      "http.request.method": "POST",
      "http.route": ROUTE
    }
  }, async (span) => {
    const body = await request.json();
    const response = NextResponse.json({ consent: body });
    response.cookies.set(CONSENT_COOKIE, JSON.stringify(body), {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365
    });
    setHttpAttributes(span, { method: "POST", route: ROUTE, status: response.status });
    return response;
  });
}
