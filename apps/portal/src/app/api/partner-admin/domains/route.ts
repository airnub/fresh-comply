import { NextResponse } from "next/server";
import {
  getSupabaseClient,
  SupabaseConfigurationError
} from "../../../../server/supabase";
import { resolveTenantBranding } from "../../../../lib/tenant-branding";

type DomainCreatePayload = {
  domain?: string;
  isPrimary?: boolean;
};

type DomainUpdatePayload = {
  action: "verify" | "setPrimary" | "updateStatus";
  domainId?: string;
  domain?: string;
  certStatus?: string;
  verifiedAt?: string | null;
};

type DomainRouteDependencies = {
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

function extractRpcResult(data: unknown) {
  const payload = (data ?? {}) as Record<string, unknown>;
  return {
    domain: payload.domain ?? null,
    audit: payload.audit_entry ?? null,
    removed: payload.removed ?? null
  };
}

export function createDomainRoutes({
  getSupabaseClient: getClient,
  resolveTenantBranding: resolveBranding
}: DomainRouteDependencies) {
  return {
    async POST(request: Request) {
      let payload: DomainCreatePayload;

      try {
        payload = (await request.json()) as DomainCreatePayload;
      } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
      }

      if (!payload.domain) {
        return NextResponse.json({ ok: false, error: "Domain is required" }, { status: 400 });
      }

      const host = request.headers.get("host");
      const tenantBranding = await resolveBranding(host);

      try {
        const supabase = getClient();
        const { data, error } = await supabase.rpc("rpc_upsert_tenant_domain", {
          p_tenant_org_id: tenantBranding.tenantOrgId,
          p_domain: payload.domain,
          p_is_primary: payload.isPrimary ?? false
        });

        if (error) {
          return formatRpcError(error);
        }

        const result = extractRpcResult(data);

        return NextResponse.json({ ok: true, domain: result.domain, audit: result.audit }, { status: 200 });
      } catch (error) {
        if (error instanceof SupabaseConfigurationError) {
          return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
        }
        return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
      }
    },

    async PATCH(request: Request) {
      let payload: DomainUpdatePayload;

      try {
        payload = (await request.json()) as DomainUpdatePayload;
      } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
      }

      const host = request.headers.get("host");
      const tenantBranding = await resolveBranding(host);

      try {
        const supabase = getClient();

        if (payload.action === "verify" || payload.action === "updateStatus") {
          if (!payload.domainId) {
            return NextResponse.json({ ok: false, error: "domainId is required" }, { status: 400 });
          }

          const { data, error } = await supabase.rpc("rpc_mark_tenant_domain_verified", {
            p_domain_id: payload.domainId,
            p_cert_status: payload.certStatus ?? "issued",
            p_verified_at: payload.verifiedAt ?? new Date().toISOString()
          });

          if (error) {
            return formatRpcError(error);
          }

          const result = extractRpcResult(data);

          return NextResponse.json({ ok: true, domain: result.domain, audit: result.audit }, { status: 200 });
        }

        if (payload.action === "setPrimary") {
          if (!payload.domain) {
            return NextResponse.json({ ok: false, error: "Domain is required" }, { status: 400 });
          }

          const { data, error } = await supabase.rpc("rpc_upsert_tenant_domain", {
            p_tenant_org_id: tenantBranding.tenantOrgId,
            p_domain: payload.domain,
            p_is_primary: true
          });

          if (error) {
            return formatRpcError(error);
          }

          const result = extractRpcResult(data);

          return NextResponse.json({ ok: true, domain: result.domain, audit: result.audit }, { status: 200 });
        }

        return NextResponse.json({ ok: false, error: "Unsupported action" }, { status: 400 });
      } catch (error) {
        if (error instanceof SupabaseConfigurationError) {
          return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
        }
        return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
      }
    },

    async DELETE(request: Request) {
      const { searchParams } = new URL(request.url);
      const domainId = searchParams.get("id");

      if (!domainId) {
        return NextResponse.json({ ok: false, error: "Domain id is required" }, { status: 400 });
      }

      const host = request.headers.get("host");
      await resolveBranding(host);

      try {
        const supabase = getClient();
        const { data, error } = await supabase.rpc("rpc_delete_tenant_domain", {
          p_domain_id: domainId
        });

        if (error) {
          return formatRpcError(error);
        }

        const result = extractRpcResult(data);

        return NextResponse.json(
          { ok: true, removed: Boolean(result.removed), audit: result.audit },
          { status: 200 }
        );
      } catch (error) {
        if (error instanceof SupabaseConfigurationError) {
          return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
        }
        return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
      }
    }
  };
}

const routes = createDomainRoutes({
  getSupabaseClient,
  resolveTenantBranding
});

export const POST = routes.POST;
export const PATCH = routes.PATCH;
export const DELETE = routes.DELETE;

export const dynamic = "force-dynamic";

export type { DomainRouteDependencies };
