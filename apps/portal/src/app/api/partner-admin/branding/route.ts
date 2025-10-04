import { NextResponse } from "next/server";
import {
  getSupabaseClient,
  SupabaseConfigurationError
} from "../../../../server/supabase";
import {
  resolveTenantBranding,
  TenantBrandingResolutionError
} from "../../../../lib/tenant-branding";

const ROUTE = "/api/partner-admin/branding";

type BrandingPayload = {
  tokens?: Record<string, unknown>;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  typography?: Record<string, unknown>;
  pdfHeader?: Record<string, unknown>;
  pdfFooter?: Record<string, unknown>;
};

type BrandingRouteDependencies = {
  getSupabaseClient: typeof getSupabaseClient;
  resolveTenantBranding: typeof resolveTenantBranding;
};

function formatRpcError(error: { message: string; code?: string; details?: string | null }) {
  const message = error.details && error.details.trim().length > 0 ? error.details : error.message;
  return NextResponse.json(
    { ok: false, error: message },
    { status: error.code === "42501" ? 403 : 400 }
  );
}

export function createBrandingRoute({
  getSupabaseClient: getClient,
  resolveTenantBranding: resolveBranding
}: BrandingRouteDependencies) {
  return {
    async POST(request: Request) {
      let payload: BrandingPayload;

      try {
        payload = (await request.json()) as BrandingPayload;
      } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
      }

      const host = request.headers.get("host");
      let tenantBranding: Awaited<ReturnType<typeof resolveBranding>>;
      try {
        tenantBranding = await resolveBranding(host);
      } catch (error) {
        if (error instanceof TenantBrandingResolutionError) {
          return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
        }
        return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
      }

      try {
        const supabase = getClient();
        const { data, error } = await supabase.rpc("rpc_upsert_tenant_branding", {
          p_org_id: tenantBranding.tenantOrgId,
          p_tokens: payload.tokens ?? {},
          p_logo_url: payload.logoUrl ?? null,
          p_favicon_url: payload.faviconUrl ?? null,
          p_typography: payload.typography ?? {},
          p_pdf_header: payload.pdfHeader ?? {},
          p_pdf_footer: payload.pdfFooter ?? {}
        });

        if (error) {
          return formatRpcError(error);
        }

        const result = (data ?? {}) as Record<string, unknown>;
        const branding = result.branding ?? null;
        const audit = result.audit_entry ?? null;

        return NextResponse.json({ ok: true, branding, audit }, { status: 200 });
      } catch (error) {
        if (error instanceof SupabaseConfigurationError) {
          return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
        }
        return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
      }
    }
  };
}

const route = createBrandingRoute({
  getSupabaseClient,
  resolveTenantBranding
});

export const POST = route.POST;

export const dynamic = "force-dynamic";

export type { BrandingRouteDependencies };
