import { generateNonce, resolveSecurityHeaders } from "@airnub/utils";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ensureLeadingLocale, negotiateLocale, setLocaleCookie } from "./i18n/request";

const publicPaths = [/\/api\//, /^\/$/, /^\/[^/]+\/\(auth\)\//];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = negotiateLocale(request);
  const nonce = generateNonce();
  const securityHeaders = resolveSecurityHeaders({ nonce, protocol: request.nextUrl.protocol });

  const applySecurityHeaders = (response: NextResponse) => {
    for (const [key, value] of Object.entries(securityHeaders)) {
      response.headers.set(key, value);
    }
    response.headers.set("x-csp-nonce", nonce);
    return response;
  };

  if (!pathname.startsWith(`/${locale}`) && !publicPaths.some((pattern) => pattern.test(pathname))) {
    const response = applySecurityHeaders(
      NextResponse.redirect(new URL(ensureLeadingLocale(pathname, locale), request.url))
    );
    setLocaleCookie(response, locale);
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-csp-nonce", nonce);
  const response = applySecurityHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders
      }
    })
  );
  setLocaleCookie(response, locale);
  return response;
}

export const config = {
  matcher: ["/:path*"],
};
