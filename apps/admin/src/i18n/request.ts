import Negotiator from "negotiator";
import { match as matchLocale } from "@formatjs/intl-localematcher";
import type { NextRequest, NextResponse } from "next/server";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, type AdminLocale, isAdminLocale, locales } from "./config";

export const localeCookieName = "fc_admin_locale";

export function negotiateLocale(request: NextRequest): AdminLocale {
  const cookieLocale = request.cookies.get(localeCookieName)?.value;
  if (isAdminLocale(cookieLocale ?? "")) {
    return cookieLocale as AdminLocale;
  }

  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) {
    const negotiator = new Negotiator({
      headers: { "accept-language": acceptLanguage },
    });
    const languages = negotiator.languages();
    const matched = matchLocale(languages, [...locales], defaultLocale);
    if (isAdminLocale(matched)) {
      return matched;
    }
  }

  return defaultLocale;
}

export function setLocaleCookie(response: NextResponse, locale: AdminLocale) {
  response.cookies.set(localeCookieName, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

export function ensureLeadingLocale(pathname: string, locale: AdminLocale) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0 || !isAdminLocale(segments[0]!)) {
    return `/${locale}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
  }
  return pathname;
}

export default getRequestConfig(async ({ locale }) => {
  if (!isAdminLocale(locale)) {
    throw new Error(`Unsupported locale: ${locale}`);
  }

  const messages = (await import(`../../messages/${locale}/common.json`)).default;

  return {
    locale,
    messages,
  };
});
