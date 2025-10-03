import { createHmac } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import Module from "node:module";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

async function withRoute<T>(callback: (route: typeof import("./route")) => Promise<T>) {
  const tempRoot = mkdtempSync(join(tmpdir(), "webhook-route-stub-"));
  const scopeRoot = join(tempRoot, "@airnub");
  const orchestratorRoot = join(scopeRoot, "orchestrator-temporal");
  const utilsRoot = join(scopeRoot, "utils");
  const previousNodePath = process.env.NODE_PATH;
  try {
    mkdirSync(orchestratorRoot, { recursive: true });
    mkdirSync(utilsRoot, { recursive: true });

    const orchestratorPackage = {
      name: "@airnub/orchestrator-temporal",
      type: "module",
      exports: "./index.js"
    } as const;
    writeFileSync(join(orchestratorRoot, "package.json"), JSON.stringify(orchestratorPackage));
    writeFileSync(join(orchestratorRoot, "index.js"), 'export class SecretAliasResolutionError extends Error {\n  constructor(alias, tenantId) {\n    super(`Unable to resolve secret alias "${alias}" for tenant "${tenantId}".`);\n    this.name = "SecretAliasResolutionError";\n  }\n}\n\nfunction sanitize(value) {\n  return value.trim().replace(/[^a-zA-Z0-9]/g, "_").replace(/_{2,}/g, "_").toUpperCase();\n}\n\nexport function resolveSecretAlias(tenantId, alias) {\n  if (!tenantId || !alias) {\n    throw new SecretAliasResolutionError(alias, tenantId);\n  }\n  const tenantKey = sanitize(tenantId);\n  const aliasKey = sanitize(alias);\n  const candidates = [\n    `FC_SECRET_${tenantKey}__${aliasKey}`,\n    `FC_SECRET__${aliasKey}`,\n    `SECRET_${tenantKey}__${aliasKey}`,\n    `SECRET__${aliasKey}`\n  ];\n  for (const key of candidates) {\n    const value = process.env[key];\n    if (typeof value === "string" && value.length > 0) {\n      return value;\n    }\n  }\n  throw new SecretAliasResolutionError(alias, tenantId);\n}');

    const utilsPackage = {
      name: "@airnub/utils",
      type: "module",
      exports: { "./telemetry": "./telemetry.js" }
    } as const;
    writeFileSync(join(utilsRoot, "package.json"), JSON.stringify(utilsPackage));
    writeFileSync(join(utilsRoot, "telemetry.js"), 'export function annotateSpan() {}\n\nexport function setHttpAttributes() {}\n\nexport function extractRunMetadataFromHeaders(headers) {\n  if (!headers) {\n    return {};\n  }\n  const get = (name) => {\n    if (headers instanceof Headers) {\n      return headers.get(name) ?? undefined;\n    }\n    return headers[name] ?? undefined;\n  };\n  const runId = get("x-fc-run-id") ?? get("x-run-id") ?? get("x-temporal-run-id");\n  const stepId = get("x-fc-step-key") ?? get("x-step-id") ?? get("x-temporal-step-id");\n  const tenantId = get("x-tenant-id") ?? get("x-fc-tenant-id") ?? get("x-temporal-tenant-id") ?? get("x-tenant-org-id");\n  const partnerOrgId = get("x-partner-org-id") ?? get("x-fc-partner-org-id") ?? get("x-temporal-partner-org-id");\n  return { runId: runId ?? undefined, stepId: stepId ?? undefined, tenantId: tenantId ?? undefined, partnerOrgId: partnerOrgId ?? undefined };\n}\n\nexport async function withTelemetrySpan(_name, _options, handler) {\n  const span = {\n    setAttribute() {},\n    recordException() {},\n    setStatus() {},\n    addEvent() {}\n  };\n  return await handler(span);\n}');

    process.env.NODE_PATH = tempRoot + (previousNodePath ? `${delimiter}${previousNodePath}` : "");
    Module._initPaths();
    const route = await import("./route");
    return await callback(route);
  } finally {
    process.env.NODE_PATH = previousNodePath;
    Module._initPaths();
    rmSync(tempRoot, { recursive: true, force: true });
  }
}


test("POST resolves secret aliases and forwards webhook requests", async () => {
  await withRoute(async ({ POST }) => {
    const baseAlias = "tests.webhooks.base";
    const tokenAlias = "tests.webhooks.token";
    const signingAlias = "tests.webhooks.signature";
    process.env.FC_SECRET__TESTS_WEBHOOKS_BASE = "https://tenant.example.com";
    process.env.FC_SECRET__TESTS_WEBHOOKS_TOKEN = "token-value";
    process.env.FC_SECRET__TESTS_WEBHOOKS_SIGNATURE = "signing-secret";

    const calls: Array<{ url: string; init: RequestInit }> = [];
    const originalFetch = global.fetch;
    global.fetch = (async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1]
    ) => {
      calls.push({ url: input instanceof URL ? input.toString() : String(input), init: init ?? {} });
      return new Response("{\"ok\":true}", {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }) as typeof global.fetch;

    try {
      const payload = {
        tenantId: "tenant-x",
        orgId: "tenant-x",
        runId: "run-123",
        stepKey: "step-1",
        request: {
          method: "POST",
          urlAlias: baseAlias,
          tokenAlias,
          path: "/integrations/fresh-comply",
          headers: { "X-Custom": "value" },
          body: { hello: "world" },
          signing: { algo: "hmac-sha256" as const, secretAlias: signingAlias }
        }
      };

      const response = await POST(
        new Request("http://localhost/api/orchestration/webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      );

      assert.equal(response.status, 200);
      const json = (await response.json()) as Record<string, unknown>;
      assert.equal(json.ok, true);
      assert.equal(calls.length, 1);

      const forwarded = calls[0]!;
      assert.equal(forwarded.url, "https://tenant.example.com/integrations/fresh-comply");
      const headers = forwarded.init.headers instanceof Headers
        ? forwarded.init.headers
        : new Headers(forwarded.init.headers);
      assert.equal(headers.get("authorization"), "Bearer token-value");
      assert.equal(headers.get("x-custom"), "value");
      assert.equal(headers.get("x-fc-tenant-id"), payload.tenantId);
      assert.ok(headers.get("x-fc-idempotency-key"));

      const expectedSignature = createHmac("sha256", "signing-secret")
        .update(JSON.stringify(payload.request.body))
        .digest("hex");
      assert.equal(headers.get("x-fc-signature"), expectedSignature);
    } finally {
      global.fetch = originalFetch;
      delete process.env.FC_SECRET__TESTS_WEBHOOKS_BASE;
      delete process.env.FC_SECRET__TESTS_WEBHOOKS_TOKEN;
      delete process.env.FC_SECRET__TESTS_WEBHOOKS_SIGNATURE;
    }
  });
});

test("POST rejects webhook configs with literal URLs", async () => {
  await withRoute(async ({ POST }) => {
    const payload = {
      tenantId: "tenant-x",
      request: {
        method: "POST",
        urlAlias: "https://example.com/webhook"
      }
    };

    const response = await POST(
      new Request("http://localhost/api/orchestration/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
    );

    assert.equal(response.status, 400);
    const json = (await response.json()) as Record<string, unknown>;
    assert.equal(json.ok, false);
  });
});
