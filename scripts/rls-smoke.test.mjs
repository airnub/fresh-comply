#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;
const migrationsDir = path.join(repoRoot, "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (!migrationFiles.length) {
  throw new Error("No Supabase migrations found. Expected tenancy migrations to exist.");
}

const migrationSql = migrationFiles
  .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"))
  .join("\n\n");

const schemaSql = readFileSync(
  path.join(repoRoot, "packages", "db", "schema.sql"),
  "utf8",
);

function assertRegex(regex, message) {
  if (!regex.test(migrationSql)) {
    throw new Error(message);
  }
}

function extractFunctionDefinition(sql, functionName) {
  const haystack = sql.toLowerCase();
  const needle = `create or replace function ${functionName.toLowerCase()}`;
  const startIndex = haystack.indexOf(needle);
  if (startIndex === -1) {
    throw new Error(`Unable to find definition for ${functionName}`);
  }

  const fromStart = sql.slice(startIndex);
  const endMarker = '$$;';
  const endIndex = fromStart.indexOf(endMarker);
  if (endIndex === -1) {
    throw new Error(`Unable to find terminator for ${functionName}`);
  }

  return fromStart.slice(0, endIndex + endMarker.length);
}

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

// Tenant access helper coverage
assertRegex(
  /create\s+or\s+replace\s+function\s+app\.has_org_access[\s\S]+app\.is_platform_admin\(\)/i,
  "app.has_org_access must call app.is_platform_admin to allow platform admins.",
);

assertRegex(
  /create\s+or\s+replace\s+function\s+app\.is_provider_admin_for[\s\S]+with\s+recursive[\s\S]+public\.orgs[\s\S]+m\.role\s+in\s+\('provider_admin',\s*'org_admin'\)/i,
  "Provider admin helper must traverse the org hierarchy with a recursive CTE and honor provider/org admin memberships.",
);

// Platform catalog policies must be locked to app.is_platform_admin
assertRegex(
  /create\s+policy[\s\S]+on\s+platform\.rule_catalogs[\s\S]+app\.is_platform_admin\(\)/i,
  "Platform rule catalog policies must require platform admin.",
);

assertRegex(
  /create\s+policy[\s\S]+on\s+platform\.rules[\s\S]+app\.is_platform_admin\(\)/i,
  "Platform rule policies must require platform admin.",
);

const schemaIsPlatformAdmin = extractFunctionDefinition(
  schemaSql,
  "app.is_platform_admin",
);
const migrationIsPlatformAdmin = extractFunctionDefinition(
  migrationSql,
  "app.is_platform_admin",
);

if (
  normalizeSql(schemaIsPlatformAdmin) !==
  normalizeSql(migrationIsPlatformAdmin)
) {
  throw new Error(
    "app.is_platform_admin definition drift detected between schema.sql and migrations.",
  );
}

const requiredFragments = [
  "coalesce(payload->>'role', '') = 'platform_admin'",
  "jsonb_typeof(payload->'is_platform_admin')",
  "lower(payload->>'is_platform_admin') in ('true','t','1','yes','y','on')",
  "coalesce(payload->>'role', '') = 'service_role'",
];

for (const fragment of requiredFragments) {
  const escaped = fragment.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  if (!new RegExp(escaped, "i").test(schemaIsPlatformAdmin)) {
    throw new Error(
      `app.is_platform_admin definition missing expected fragment: ${fragment}`,
    );
  }
}

const truthyStrings = new Set(["true", "t", "1", "yes", "y", "on"]);

function simulateIsPlatformAdmin(claims = {}) {
  const payload = { ...claims };
  const role = typeof payload.role === "string" ? payload.role : "";
  if (role === "platform_admin") {
    return true;
  }

  const helperFlag = payload.is_platform_admin;
  let helperResult = false;

  if (typeof helperFlag === "boolean") {
    helperResult = helperFlag;
  } else if (typeof helperFlag === "string") {
    helperResult = truthyStrings.has(helperFlag.toLowerCase());
  } else if (typeof helperFlag === "number") {
    helperResult = helperFlag !== 0;
  }

  if (helperResult) {
    return true;
  }

  return role === "service_role";
}

const helperTestVectors = [
  { name: "platform_admin role", claims: { role: "platform_admin" }, expected: true },
  { name: "service_role bypass", claims: { role: "service_role" }, expected: true },
  { name: "boolean helper flag", claims: { is_platform_admin: true }, expected: true },
  { name: "string helper flag", claims: { is_platform_admin: "yes" }, expected: true },
  { name: "numeric helper flag", claims: { is_platform_admin: 1 }, expected: true },
  { name: "member role denied", claims: { role: "member" }, expected: false },
  { name: "explicit string false", claims: { is_platform_admin: "false" }, expected: false },
  { name: "numeric zero false", claims: { is_platform_admin: 0 }, expected: false },
  { name: "missing claims", claims: {}, expected: false },
];

for (const { name, claims, expected } of helperTestVectors) {
  assert.equal(
    simulateIsPlatformAdmin(claims),
    expected,
    `app.is_platform_admin helper regression failed for scenario: ${name}`,
  );
}

// Verify that RLS template installs four policies driven by app.has_org_access
assertRegex(
  /create\s+policy\s+%I\s+on\s+%s\s+for\s+select\s+using\s+\(app\.has_org_access\(org_id\)\)/i,
  "Select policy template must enforce app.has_org_access(org_id).",
);
assertRegex(
  /create\s+policy\s+%I\s+on\s+%s\s+for\s+insert\s+with\s+check\s+\(app\.has_org_access\(org_id\)\)/i,
  "Insert policy template must use app.has_org_access(org_id).",
);
assertRegex(
  /create\s+policy\s+%I\s+on\s+%s\s+for\s+update\s+using\s+\(app\.has_org_access\(org_id\)\)\s+with\s+check\s+\(app\.has_org_access\(org_id\)\)/i,
  "Update policy template must use app.has_org_access(org_id).",
);
assertRegex(
  /create\s+policy\s+%I\s+on\s+%s\s+for\s+delete\s+using\s+\(app\.has_org_access\(org_id\)\)/i,
  "Delete policy template must use app.has_org_access(org_id).",
);

// Negative coverage: forbid tenancy gates that rely on IS NULL checks within migrations
if (/create\s+policy[\s\S]{0,200}(tenant_org_id|org_id)\s+is\s+null/i.test(migrationSql)) {
  throw new Error("Migrations must not rely on tenancy columns with IS NULL guards inside policies.");
}

// Negative coverage: ensure no SQL migration introduces writes to platform.* outside platform schema definitions
const platformWriteMatches = migrationSql.match(/(insert|update|delete)\s+into\s+platform\.[a-z_]+/gi) ?? [];
if (platformWriteMatches.some((match) => !match.toLowerCase().includes("platform.global_records"))) {
  throw new Error("Unexpected write detected against platform.* in migrations");
}

// Static check to ensure client code never writes to platform.*
const appsDir = path.join(repoRoot, "apps");
const writePattern = /(insert|update|upsert|delete)\s*\([\s\S]*?platform\./i;
for (const app of readdirSync(appsDir, { withFileTypes: true })) {
  if (!app.isDirectory()) continue;
  const appPath = path.join(appsDir, app.name);
  const stack = [appPath];
  while (stack.length) {
    const current = stack.pop();
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) {
          continue;
        }
        stack.push(entryPath);
        continue;
      }
      if (!entry.name.match(/\.(ts|tsx|mjs|js)$/)) continue;
      const contents = readFileSync(entryPath, "utf8");
      if (writePattern.test(contents)) {
        throw new Error(`Client code ${entryPath} appears to mutate platform.* tables.`);
      }
    }
  }
}

console.log("RLS smoke assertions passed for tenancy helpers, platform catalog protections, and client write guards.");
