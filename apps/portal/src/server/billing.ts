import { headers } from "next/headers";
import { getSupabaseClient, SupabaseConfigurationError } from "./supabase";
import type { Database } from "@airnub/types";
import { getTenantBrandingFromHeaders } from "../lib/tenant-branding";

export type BillingSubscriptionOverviewRow =
  Database["public"]["Views"]["billing_subscription_overview"]["Row"];

export interface TenantBillingOverviewResult {
  tenantOrgId: string;
  overview: BillingSubscriptionOverviewRow | null;
}

export async function loadTenantBillingOverview(): Promise<TenantBillingOverviewResult> {
  const headerStore = headers();
  const branding = getTenantBrandingFromHeaders(headerStore);

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("billing_subscription_overview")
      .select("*")
      .eq("tenant_org_id", branding.tenantOrgId)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to load billing overview: ${error.message}`);
    }

    return {
      tenantOrgId: branding.tenantOrgId,
      overview: (data as BillingSubscriptionOverviewRow | null) ?? null
    };
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      console.error(error.message);
      return { tenantOrgId: branding.tenantOrgId, overview: null };
    }
    throw error;
  }
}
