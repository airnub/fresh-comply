import { annotateSuccess, recordSpanError, withSpan } from "@airnub/utils";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const CONSENT_COOKIE = "fc_consent";

export async function GET() {
  return withSpan(
    "portal.api.consent.get",
    { attributes: { "http.method": "GET", "http.route": "/api/consent" } },
    async (span) => {
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
      span.setAttributes({ "http.status_code": response.status });
      annotateSuccess(span);
      return response;
    }
  );
}

export async function POST(request: NextRequest) {
  return withSpan(
    "portal.api.consent.post",
    { attributes: { "http.method": "POST", "http.route": "/api/consent" } },
    async (span) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch (error) {
        span.setAttributes({ "http.status_code": 400, "freshcomply.validation": "invalid_json" });
        return NextResponse.json({ ok: false, error: "Invalid consent payload" }, { status: 400 });
      }

      try {
        const response = NextResponse.json({ consent: body });
        response.cookies.set(CONSENT_COOKIE, JSON.stringify(body), {
          path: "/",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 365
        });
        span.setAttributes({ "http.status_code": response.status });
        annotateSuccess(span);
        return response;
      } catch (error) {
        recordSpanError(span, error);
        span.setAttributes({ "http.status_code": 500 });
        return NextResponse.json({ ok: false, error: "Unable to persist consent" }, { status: 500 });
      }
    }
  );
}
