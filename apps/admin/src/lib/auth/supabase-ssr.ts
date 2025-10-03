import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@airnub/types";
import { cookies } from "next/headers";

export type AdminSupabaseClient = SupabaseClient<Database>;

class SupabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigurationError";
  }
}

function resolveSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new SupabaseConfigurationError(
      "Supabase environment variables NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined."
    );
  }

  return { url, anonKey };
}

function cookieAdapter() {
  const cookieStore = cookies();

  const setCookie = (name: string, value: string, options?: CookieOptions) => {
    try {
      (cookieStore as unknown as { set: (name: string, value: string, options?: CookieOptions) => void }).set(
        name,
        value,
        options
      );
    } catch (error) {
      console.warn(`[admin:supabase] Unable to set cookie "${name}"`, error);
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
    },
  };
}

export function getSupabaseClient(): AdminSupabaseClient {
  const { url, anonKey } = resolveSupabaseEnv();
  const adapter = cookieAdapter();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      get: adapter.get,
      set: adapter.set,
      remove: adapter.remove,
    },
  });
}

export async function getSupabaseSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getSession();

  if (error) {
    throw new Error(`Unable to resolve Supabase session: ${error.message}`);
  }

  return data.session ?? null;
}

export async function getSupabaseUser(): Promise<User | null> {
  const client = getSupabaseClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) {
    throw new Error(`Unable to resolve Supabase user: ${error.message}`);
  }

  return user ?? null;
}

export { SupabaseConfigurationError };
