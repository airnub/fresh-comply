import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ensureLeadingLocale, negotiateLocale, setLocaleCookie } from "./i18n/request";
import { buildSecurityHeaders, generateNonce, SECURITY_NONCE_HEADER } from "@airnub/utils/security-headers";

const publicPaths = [/\/api\//, /^\/$/, /^\/[^/]+\/\(auth\)\//];

function applySecurityHeaders(response: NextResponse, nonce: string) {
  const headers = buildSecurityHeaders(nonce);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = generateNonce();
  const locale = negotiateLocale(request);

  if (!pathname.startsWith(`/${locale}`) && !publicPaths.some((pattern) => pattern.test(pathname))) {
    const response = NextResponse.redirect(new URL(ensureLeadingLocale(pathname, locale), request.url));
    setLocaleCookie(response, locale);
    return applySecurityHeaders(response, nonce);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(SECURITY_NONCE_HEADER, nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
  setLocaleCookie(response, locale);
  return applySecurityHeaders(response, nonce);
}

export const config = {
  matcher: ["/:path*"],
};
