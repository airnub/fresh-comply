import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@airnub/types/supabase";

export type ServiceSupabaseClient = SupabaseClient<Database>;

export class SupabaseServiceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseServiceConfigurationError";
  }
}

function resolveServiceEnv() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new SupabaseServiceConfigurationError(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set for service operations."
    );
  }

  return { url, serviceKey };
}

export function getServiceSupabaseClient(): ServiceSupabaseClient {
  const { url, serviceKey } = resolveServiceEnv();
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false }
  });
}
