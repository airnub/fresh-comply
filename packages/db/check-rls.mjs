import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, "schema.sql");

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
  "dsr_request_jobs",
  "source_registry",
  "source_snapshot",
  "change_event",
  "rule_versions",
  "template_versions",
  "workflow_def_versions",
  "workflow_pack_versions",
  "moderation_queue",
  "release_notes",
  "adoption_records"
];

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
  dsr_request_jobs: ["Service role manages DSR jobs"],
  source_registry: [
    "Service role manages source registry",
    "Tenant members read source registry"
  ],
  source_snapshot: [
    "Service role manages source snapshots",
    "Tenant members read source snapshots"
  ],
  change_event: [
    "Service role manages change events",
    "Tenant members read change events"
  ],
  rule_versions: [
    "Service role manages rule versions",
    "Tenant members read rule versions"
  ],
  template_versions: [
    "Service role manages template versions",
    "Tenant members read template versions"
  ],
  workflow_def_versions: [
    "Service role manages workflow def versions",
    "Tenant members read workflow def versions"
  ],
  workflow_pack_versions: [
    "Service role manages workflow pack versions",
    "Tenant members read workflow pack versions"
  ],
  moderation_queue: [
    "Service role manages moderation queue",
    "Tenant members view moderation queue"
  ],
  release_notes: [
    "Service role manages release notes",
    "Tenant members read release notes"
  ],
  adoption_records: [
    "Service role manages adoption records",
    "Tenant members read adoption records",
    "Tenant members insert adoption records"
  ]
};

export function checkRlsSchema(schema) {
  const missingRls = tablesWithRls.filter((table) => {
    const pattern = new RegExp(
      `alter\\s+table\\s+${table}\\s+enable\\s+row\\s+level\\s+security`,
      "i"
    );
    return !pattern.test(schema);
  });

  if (missingRls.length > 0) {
    throw new Error(`Missing RLS enablement for: ${missingRls.join(", ")}`);
  }

  const missingPolicies = Object.entries(requiredPolicies).flatMap(([table, policies]) =>
    policies
      .filter((policy) => !schema.includes(`create policy "${policy}" on ${table}`))
      .map((policy) => `${table}: ${policy}`)
  );

  if (missingPolicies.length > 0) {
    throw new Error(`Missing required policies:\n - ${missingPolicies.join("\n - ")}`);
  }

  if (!schema.includes("create or replace function public.is_member_of_org")) {
    throw new Error("Function public.is_member_of_org is not defined in schema.sql");
  }

  if (!schema.includes("create or replace function public.can_access_run")) {
    throw new Error("Function public.can_access_run is not defined in schema.sql");
  }

  const policyRegex = /create\s+policy\s+"([^"]+)"\s+on\s+([^\s]+)[\s\S]*?;/gi;
  const prohibitedColumns = ["tenant_org_id", "org_id"];
  const policiesWithNullChecks = [];

  let policyMatch;
  while ((policyMatch = policyRegex.exec(schema)) !== null) {
    const [policyBlock, policyName, tableName] = policyMatch;
    const policyBlockLower = policyBlock.toLowerCase();

    for (const column of prohibitedColumns) {
      if (policyBlockLower.includes(`${column.toLowerCase()} is null`)) {
        policiesWithNullChecks.push({ column, policyRef: `${tableName}.${policyName}` });
      }
    }
  }

  if (policiesWithNullChecks.length > 0) {
    const offendingColumns = [
      ...new Set(policiesWithNullChecks.map(({ column }) => column))
    ];

    const columnList =
      offendingColumns.length === 1
        ? offendingColumns[0]
        : `${offendingColumns.slice(0, -1).join(", ")} or ${
            offendingColumns[offendingColumns.length - 1]
          }`;

    const policiesList = policiesWithNullChecks
      .map(({ policyRef }) => policyRef)
      .join("\n - ");

    throw new Error(
      `Policies must not rely on ${columnList} being NULL:\n - ${policiesList}`
    );
  }

  return { tablesWithRls };
}

export async function verifyRls({ schema } = {}) {
  const schemaText = schema ?? (await readFile(schemaPath, "utf8"));
  return checkRlsSchema(schemaText);
}

async function runCli() {
  try {
    const { tablesWithRls: tables } = await verifyRls();
    console.log("✅ RLS enforcement verified for tables:", tables.join(", "));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

const isCliExecution = Boolean(
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
);

if (isCliExecution) {
  await runCli();
}
