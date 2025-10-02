import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const CONSENT_COOKIE = "fc_consent";

export async function GET() {
  const consentCookie = cookies().get(CONSENT_COOKIE)?.value;
  let consent: unknown = null;
  if (consentCookie) {
    try {
      consent = JSON.parse(consentCookie);
    } catch {
      consent = consentCookie;
    }
  }
  return NextResponse.json({ consent });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const response = NextResponse.json({ consent: body });
  response.cookies.set(CONSENT_COOKIE, JSON.stringify(body), {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365
  });
  return response;
}
