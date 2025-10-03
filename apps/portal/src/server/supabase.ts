import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@airnub/types";
import { cookies } from "next/headers";

export type AppSupabaseClient = SupabaseClient<Database>;
export type UserProfile = Pick<Tables<"users">, "id" | "email" | "name">;

class SupabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigurationError";
  }
}

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new SupabaseConfigurationError(
      "Supabase environment variables NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set."
    );
  }

  return { url, anonKey };
}

function withMutableCookies() {
  const cookieStore = cookies();

  const setCookie = (name: string, value: string, options?: CookieOptions) => {
    try {
      (cookieStore as unknown as { set: (name: string, value: string, options?: CookieOptions) => void }).set(
        name,
        value,
        options
      );
    } catch (error) {
      console.warn(`[supabase] Unable to set cookie "${name}"`, error);
    }
  };

  const removeCookie = (name: string, options?: CookieOptions) => {
    setCookie(name, "", { ...options, maxAge: 0 });
  };

  return {
    get(name: string) {
      return cookieStore.get(name)?.value;
    },
    set(name: string, value: string, options?: CookieOptions) {
      setCookie(name, value, options);
    },
    remove(name: string, options?: CookieOptions) {
      removeCookie(name, options);
    }
  };
}

export function getSupabaseClient(): AppSupabaseClient {
  const { url, anonKey } = getSupabaseEnv();
  const cookieAdapter = withMutableCookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      get: cookieAdapter.get,
      set: cookieAdapter.set,
      remove: cookieAdapter.remove
    }
  });
}

export async function getSupabaseSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getSession();

  if (error) {
    throw new Error(`Unable to fetch Supabase session: ${error.message}`);
  }

  return data.session ?? null;
}

export async function getActiveUserProfile(): Promise<UserProfile | null> {
  const client = getSupabaseClient();
  const {
    data: { user },
    error
  } = await client.auth.getUser();

  if (error) {
    throw new Error(`Unable to resolve authenticated user: ${error.message}`);
  }

  if (!user) {
    return null;
  }

  const { data: profile, error: profileError } = await client
    .from("users")
    .select("id, email, name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Unable to load user profile: ${profileError.message}`);
  }

  return {
    id: profile?.id ?? user.id,
    email: profile?.email ?? user.email ?? "",
    name: profile?.name ?? (user.user_metadata?.full_name as string | null) ?? null
  };
}

export { SupabaseConfigurationError };
