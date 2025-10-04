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

function assertRegex(regex, message) {
  if (!regex.test(migrationSql)) {
    throw new Error(message);
  }
}

// Tenant access helper coverage
assertRegex(
  /create\s+or\s+replace\s+function\s+app\.has_org_access[\s\S]+app\.is_platform_admin\(\)/i,
  "app.has_org_access must call app.is_platform_admin to allow platform admins."
);

assertRegex(
  /create\s+or\s+replace\s+function\s+app\.is_provider_admin_for[\s\S]+with\s+recursive[\s\S]+public\.orgs[\s\S]+m\.role\s+in\s+\('provider_admin',\s*'org_admin'\)/i,
  "Provider admin helper must traverse the org hierarchy with a recursive CTE and honor provider/org admin memberships."
);

// Platform catalog policies must be locked to app.is_platform_admin
assertRegex(
  /create\s+policy[\s\S]+on\s+platform\.rule_catalogs[\s\S]+app\.is_platform_admin\(\)/i,
  "Platform rule catalog policies must require platform admin."
);

assertRegex(
  /create\s+policy[\s\S]+on\s+platform\.rules[\s\S]+app\.is_platform_admin\(\)/i,
  "Platform rule policies must require platform admin."
);

// Verify that RLS template installs four policies driven by app.has_org_access
assertRegex(
  /create\s+policy\s+%I\s+on\s+%s\s+for\s+select\s+using\s+\(app\.has_org_access\(org_id\)\)/i,
  "Select policy template must enforce app.has_org_access(org_id)."
);
assertRegex(
  /create\s+policy\s+%I\s+on\s+%s\s+for\s+insert\s+with\s+check\s+\(app\.has_org_access\(org_id\)\)/i,
  "Insert policy template must use app.has_org_access(org_id)."
);
assertRegex(
  /create\s+policy\s+%I\s+on\s+%s\s+for\s+update\s+using\s+\(app\.has_org_access\(org_id\)\)\s+with\s+check\s+\(app\.has_org_access\(org_id\)\)/i,
  "Update policy template must use app.has_org_access(org_id)."
);
assertRegex(
  /create\s+policy\s+%I\s+on\s+%s\s+for\s+delete\s+using\s+\(app\.has_org_access\(org_id\)\)/i,
  "Delete policy template must use app.has_org_access(org_id)."
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
