import { createRouteHandlerClient } from "@supabase/ssr";
import type { Database } from "@airnub/types";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { defaultLocale, isAppLocale } from "../../../i18n/config";

export const dynamic = "force-dynamic";

function sanitizeRedirect(target?: string | null) {
  if (!target) return `/${defaultLocale}`;
  if (!target.startsWith("/") || target.startsWith("//")) {
    return `/${defaultLocale}`;
  }

  const [maybeLocale] = target.split("/").filter(Boolean);
  if (maybeLocale && !isAppLocale(maybeLocale) && !target.startsWith(`/auth`)) {
    return `/${defaultLocale}`;
  }

  return target;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectTo = sanitizeRedirect(requestUrl.searchParams.get("redirect"));
  const response = NextResponse.redirect(new URL(redirectTo, requestUrl.origin));

  if (!code) {
    return response;
  }

  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("Supabase magic link exchange failed", error);
      response.cookies.set("supabase-auth-error", error.message, {
        httpOnly: true,
        path: "/",
        maxAge: 60,
        sameSite: "lax"
      });
    }
  } catch (error) {
    console.error("Supabase callback error", error);
    response.cookies.set("supabase-auth-error", "exchange_failed", {
      httpOnly: true,
      path: "/",
      maxAge: 60,
      sameSite: "lax"
    });
  }

  return response;
}
