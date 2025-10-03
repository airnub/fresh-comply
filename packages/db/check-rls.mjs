import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, "schema.sql");
const schema = await readFile(schemaPath, "utf8");

const tablesWithRls = [
  "organisations",
  "users",
  "memberships",
  "engagements",
  "workflow_defs",
  "workflow_runs",
  "steps",
  "documents",
  "audit_log",
  "admin_actions",
  "dsr_requests",
  "dsr_request_jobs"
];

const missingRls = tablesWithRls.filter((table) => {
  const pattern = new RegExp(`alter\\s+table\\s+${table}\\s+enable\\s+row\\s+level\\s+security`, "i");
  return !pattern.test(schema);
});

if (missingRls.length > 0) {
  console.error("Missing RLS enablement for:", missingRls.join(", "));
  process.exit(1);
}

const requiredPolicies = {
  organisations: ["Members read organisations", "Service role manages organisations"],
  users: [
    "Users can view their profile",
    "Users can update their profile",
    "Service role manages users"
  ],
  memberships: ["Users can read their memberships", "Service role manages memberships"],
  engagements: ["Members view engagements", "Service role manages engagements"],
  workflow_defs: [
    "Authenticated can view workflow definitions",
    "Service role manages workflow definitions"
  ],
  workflow_runs: ["Members access workflow runs", "Service role manages workflow runs"],
  steps: ["Members read steps", "Service role manages steps"],
  documents: ["Members read documents", "Service role manages documents"],
  audit_log: ["Members read audit log", "Service role appends audit log"],
  admin_actions: ["Members read admin actions", "Service role appends admin actions"],
  dsr_requests: ["Members view DSR requests", "Members manage DSR requests"],
  dsr_request_jobs: ["Service role manages DSR jobs"]
};

const missingPolicies = Object.entries(requiredPolicies).flatMap(([table, policies]) =>
  policies
    .filter((policy) => !schema.includes(`create policy "${policy}" on ${table}`))
    .map((policy) => `${table}: ${policy}`)
);

if (missingPolicies.length > 0) {
  console.error("Missing required policies:\n -", missingPolicies.join("\n - "));
  process.exit(1);
}

if (!schema.includes("create or replace function public.is_member_of_org")) {
  console.error("Function public.is_member_of_org is not defined in schema.sql");
  process.exit(1);
}

if (!schema.includes("create or replace function public.can_access_run")) {
  console.error("Function public.can_access_run is not defined in schema.sql");
  process.exit(1);
}

console.log(
  "✅ RLS enforcement verified for tables:",
  tablesWithRls.join(", ")
);
