import { headers } from "next/headers";
import { getSupabaseClient, SupabaseConfigurationError } from "./supabase";
import type { Tables } from "@airnub/types";
import {
  getTenantBrandingFromHeaders,
  toDocumentBrandingMetadata,
  type TenantBrandingPayload
} from "../lib/tenant-branding";

export type TenantBrandingRow = Tables<"tenant_branding"> | null;
export type TenantDomainRow = Tables<"tenant_domains">;

export async function loadTenantBrandingSettings() {
  const headerStore = headers();
  const resolvedBranding = getTenantBrandingFromHeaders(headerStore);
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("rpc_get_tenant_branding", {
      p_tenant_org_id: resolvedBranding.tenantOrgId
    });

    if (error) {
      throw new Error(`Unable to load tenant branding: ${error.message}`);
    }

    return {
      tenantOrgId: resolvedBranding.tenantOrgId,
      brandingRow: (data as TenantBrandingRow) ?? null,
      resolvedBranding,
      documentBranding: toDocumentBrandingMetadata(resolvedBranding)
    };
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      console.error(error.message);
      return {
        tenantOrgId: resolvedBranding.tenantOrgId,
        brandingRow: null,
        resolvedBranding,
        documentBranding: toDocumentBrandingMetadata(resolvedBranding)
      };
    }
    throw error;
  }
}

export async function loadTenantDomains() {
  const headerStore = headers();
  const branding = getTenantBrandingFromHeaders(headerStore);
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("tenant_domains")
      .select("id, domain, is_primary, verified_at, cert_status, created_at, updated_at")
      .eq("tenant_org_id", branding.tenantOrgId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Unable to load tenant domains: ${error.message}`);
    }

    return {
      tenantOrgId: branding.tenantOrgId,
      domains: (data as TenantDomainRow[]) ?? [],
      resolvedBranding: branding
    };
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      console.error(error.message);
      return {
        tenantOrgId: branding.tenantOrgId,
        domains: [],
        resolvedBranding: branding
      };
    }
    throw error;
  }
}

export function getTenantContextFromHeaders(): { tenantOrgId: string; branding: TenantBrandingPayload } {
  const headerStore = headers();
  const branding = getTenantBrandingFromHeaders(headerStore);
  return { tenantOrgId: branding.tenantOrgId, branding };
}
