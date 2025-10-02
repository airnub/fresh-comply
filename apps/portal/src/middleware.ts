import { NextRequest, NextResponse } from "next/server";
import { type AppLocale, defaultLocale, isAppLocale } from "./i18n/config";
import { ensureLeadingLocale, negotiateLocale, setLocaleCookie } from "./i18n/request";

const PUBLIC_FILE = /\.(.*)$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split("/").filter(Boolean);
  const currentSegment = segments[0];

  if (!isAppLocale(currentSegment)) {
    const locale = negotiateLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = ensureLeadingLocale(pathname === "/" ? "" : pathname, locale);
    const response = NextResponse.redirect(url);
    setLocaleCookie(response, locale);
    return response;
  }

  const locale = (currentSegment ?? defaultLocale) as AppLocale;
  const response = NextResponse.next();
  setLocaleCookie(response, locale);
  return response;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"]
};
