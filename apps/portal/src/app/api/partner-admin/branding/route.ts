import { NextResponse } from "next/server";
import {
  getSupabaseClient,
  SupabaseConfigurationError
} from "../../../../server/supabase";
import { resolveTenantBranding } from "../../../../lib/tenant-branding";

const ROUTE = "/api/partner-admin/branding";

type BrandingPayload = {
  tokens?: Record<string, unknown>;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  typography?: Record<string, unknown>;
  pdfHeader?: Record<string, unknown>;
  pdfFooter?: Record<string, unknown>;
};

export async function POST(request: Request) {
  let payload: BrandingPayload;

  try {
    payload = (await request.json()) as BrandingPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const host = request.headers.get("host");
  const tenantBranding = await resolveTenantBranding(host);

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("rpc_upsert_tenant_branding", {
      p_tenant_org_id: tenantBranding.tenantOrgId,
      p_tokens: payload.tokens ?? {},
      p_logo_url: payload.logoUrl ?? null,
      p_favicon_url: payload.faviconUrl ?? null,
      p_typography: payload.typography ?? {},
      p_pdf_header: payload.pdfHeader ?? {},
      p_pdf_footer: payload.pdfFooter ?? {}
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.code === "42501" ? 403 : 400 }
      );
    }

    return NextResponse.json({ ok: true, branding: data }, { status: 200 });
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
