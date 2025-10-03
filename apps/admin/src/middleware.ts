import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ensureLeadingLocale, negotiateLocale, setLocaleCookie } from "./i18n/request";

const publicPaths = [/\/api\//, /^\/$/, /^\/[^/]+\/\(auth\)\//];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = negotiateLocale(request);

  if (!pathname.startsWith(`/${locale}`) && !publicPaths.some((pattern) => pattern.test(pathname))) {
    const response = NextResponse.redirect(new URL(ensureLeadingLocale(pathname, locale), request.url));
    setLocaleCookie(response, locale);
    return response;
  }

  const response = NextResponse.next();
  setLocaleCookie(response, locale);
  return response;
}

export const config = {
  matcher: ["/:path*"],
};
