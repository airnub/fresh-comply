import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@airnub/types";
import { NextRequest, NextResponse } from "next/server";
import { type AppLocale, defaultLocale, isAppLocale } from "./i18n/config";
import { ensureLeadingLocale, negotiateLocale, setLocaleCookie } from "./i18n/request";

const PUBLIC_FILE = /\.(.*)$/;

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase environment variables NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.");
  }

  return { url, anonKey };
}

function createMiddlewareSupabaseClient(request: NextRequest, response: NextResponse) {
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options?: CookieOptions) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options?: CookieOptions) {
        response.cookies.set({ name, value: "", ...options, maxAge: 0 });
      }
    }
  });
}

async function getSupabaseSession(request: NextRequest, response: NextResponse) {
  try {
    const supabase = createMiddlewareSupabaseClient(request, response);
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Supabase middleware session error", error.message);
      return null;
    }
    return data.session ?? null;
  } catch (error) {
    console.error("Supabase middleware unavailable", error);
    return null;
  }
}

export async function middleware(request: NextRequest) {
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

  if (pathname.startsWith("/auth")) {
    const response = NextResponse.next();
    await getSupabaseSession(request, response);
    return response;
  }

  if (!isAppLocale(currentSegment)) {
    const locale = negotiateLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = ensureLeadingLocale(pathname === "/" ? "" : pathname, locale);
    const response = NextResponse.redirect(url);
    await getSupabaseSession(request, response);
    setLocaleCookie(response, locale);
    return response;
  }

  const locale = (currentSegment ?? defaultLocale) as AppLocale;
  const response = NextResponse.next();
  const session = await getSupabaseSession(request, response);

  if (!session) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/auth/sign-in";
    signInUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(signInUrl);
  }

  setLocaleCookie(response, locale);
  return response;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"]
};
