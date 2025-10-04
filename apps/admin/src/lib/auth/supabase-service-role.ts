import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@airnub/types";

let cachedClient: SupabaseClient<Database> | null = null;

class SupabaseServiceRoleConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseServiceRoleConfigurationError";
  }
}

function resolveServiceRoleEnv() {
  const url = process.env.SUPABASE_SERVICE_ROLE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new SupabaseServiceRoleConfigurationError(
      "Supabase service role URL is not configured. Set SUPABASE_SERVICE_ROLE_URL or NEXT_PUBLIC_SUPABASE_URL."
    );
  }

  if (!serviceRoleKey) {
    throw new SupabaseServiceRoleConfigurationError(
      "Supabase service role key is not configured. Set SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return { url, serviceRoleKey };
}

export function getSupabaseServiceRoleClient(): SupabaseClient<Database> {
  if (typeof window !== "undefined") {
    throw new SupabaseServiceRoleConfigurationError(
      "Supabase service-role client is restricted to server-side execution."
    );
  }

  if (!cachedClient) {
    const { url, serviceRoleKey } = resolveServiceRoleEnv();
    cachedClient = createClient<Database>(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return cachedClient;
}

export { SupabaseServiceRoleConfigurationError };
