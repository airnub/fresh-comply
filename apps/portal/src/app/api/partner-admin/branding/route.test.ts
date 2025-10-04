import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import Module from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

async function withBrandingRoute<T>(callback: (route: typeof import("./route")) => Promise<T>) {
  const tempRoot = mkdtempSync(join(tmpdir(), "branding-route-stub-"));
  const nextRoot = join(tempRoot, "next");
  const supabaseRoot = join(tempRoot, "@supabase", "ssr");
  const previousNodePath = process.env.NODE_PATH;
  try {
    mkdirSync(nextRoot, { recursive: true });
    mkdirSync(supabaseRoot, { recursive: true });
    const packageJson = {
      name: "next",
      type: "module",
      exports: {
        "./server": "./server.js",
        "./headers": "./headers.js"
      }
    } as const;
    writeFileSync(join(nextRoot, "package.json"), JSON.stringify(packageJson));
    writeFileSync(
      join(nextRoot, "server.js"),
      "export class NextResponse extends Response {\n  static json(body, init = {}) {\n    const headers = new Headers(init.headers ?? {});\n    if (!headers.has(\"content-type\")) {\n      headers.set(\"content-type\", \"application/json\");\n    }\n    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: init.status ?? 200, headers });\n  }\n}\n"
    );
    writeFileSync(
      join(nextRoot, "headers.js"),
      "const store = new Map();\nexport function cookies() {\n  return {\n    get(name) {\n      return store.has(name) ? { value: store.get(name) } : undefined;\n    },\n    set(name, value) {\n      store.set(name, value);\n    },\n    remove(name) {\n      store.delete(name);\n    }\n  };\n}\n"
    );

    const supabasePackage = {
      name: "@supabase/ssr",
      type: "module",
      exports: "./index.js"
    } as const;
    writeFileSync(join(supabaseRoot, "package.json"), JSON.stringify(supabasePackage));
    writeFileSync(
      join(supabaseRoot, "index.js"),
      "export function createServerClient() {\n  return { rpc() { throw new Error('not implemented in tests'); } };\n}\n"
    );

    process.env.NODE_PATH = tempRoot + (previousNodePath ? `:${previousNodePath}` : "");
    Module._initPaths();

    const route = await import(pathToFileURL(join(process.cwd(), "src/app/api/partner-admin/branding/route.ts")).toString());
    return await callback(route);
  } finally {
    process.env.NODE_PATH = previousNodePath;
    Module._initPaths();
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

const tenantBrandingStub = {
  tenantOrgId: "tenant-123",
  domain: "tenant.example.com",
  tokens: {},
  logoUrl: null,
  faviconUrl: null,
  typography: null,
  pdfHeader: null,
  pdfFooter: null,
  updatedAt: null
} as const;

test("POST upserts branding and returns audit metadata", async () => {
  await withBrandingRoute(async ({ createBrandingRoute }) => {
    const rpcCalls: Array<{ name: string; params: Record<string, unknown> }> = [];

    const supabase = {
      async rpc(name: string, params: Record<string, unknown>) {
        rpcCalls.push({ name, params });
        return {
          data: {
            branding: {
              org_id: tenantBrandingStub.tenantOrgId,
              tokens: { theme: "custom" },
              logo_url: "https://cdn.example.com/logo.png",
              favicon_url: null,
              typography: {},
              pdf_header: {},
              pdf_footer: {}
            },
            audit_entry: {
              audit_id: "audit-1",
              action: "tenant_branding_update",
              reason_code: "tenant_branding_update"
            }
          },
          error: null
        } as const;
      }
    };

    const route = createBrandingRoute({
      getSupabaseClient: () => supabase,
      resolveTenantBranding: async (host: string | null | undefined) => {
        assert.equal(host, "tenant.example.com");
        return tenantBrandingStub;
      }
    });

    const request = new Request("http://localhost/api/partner-admin/branding", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "tenant.example.com"
      },
      body: JSON.stringify({ tokens: { theme: "custom" } })
    });

    const response = await route.POST(request);
    assert.equal(response.status, 200);
    const json = (await response.json()) as Record<string, unknown>;

    assert.equal(json.ok, true);
    assert.deepEqual(json.branding, {
      org_id: tenantBrandingStub.tenantOrgId,
      tokens: { theme: "custom" },
      logo_url: "https://cdn.example.com/logo.png",
      favicon_url: null,
      typography: {},
      pdf_header: {},
      pdf_footer: {}
    });
    assert.deepEqual(json.audit, {
      audit_id: "audit-1",
      action: "tenant_branding_update",
      reason_code: "tenant_branding_update"
    });

    assert.equal(rpcCalls.length, 1);
    assert.equal(rpcCalls[0]?.name, "rpc_upsert_tenant_branding");
    assert.equal(rpcCalls[0]?.params?.p_org_id, tenantBrandingStub.tenantOrgId);
  });
});

test("POST surfaces audit failures", async () => {
  await withBrandingRoute(async ({ createBrandingRoute }) => {
    const route = createBrandingRoute({
      getSupabaseClient: () => ({
        async rpc() {
          return {
            data: null,
            error: {
              message: "Audit write failed",
              details: "audit ledger append refused",
              code: "40001"
            }
          } as const;
        }
      }),
      resolveTenantBranding: async () => tenantBrandingStub
    });

    const request = new Request("http://localhost/api/partner-admin/branding", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "tenant.example.com"
      },
      body: JSON.stringify({ tokens: {} })
    });

    const response = await route.POST(request);
    assert.equal(response.status, 400);
    const json = (await response.json()) as Record<string, unknown>;
    assert.equal(json.ok, false);
    assert.equal(json.error, "audit ledger append refused");
  });
});
