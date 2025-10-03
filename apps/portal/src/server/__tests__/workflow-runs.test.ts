import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import Module from "node:module";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createInMemorySupabase } from "../../../../../packages/freshness/src/testing/inMemorySupabase.js";
import type { OverlayReference } from "@airnub/engine/types";

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const WORKFLOW_DEF_ID = "00000000-0000-0000-0000-000000000010";

const baseGraph = {
  id: "setup-nonprofit",
  version: "1.0.0",
  steps: [
    {
      id: "base-step",
      kind: "info",
      title: "Base",
      verify: [{ id: "rule.deadline" }]
    }
  ]
};

test("createWorkflowRun materialises lockfile and stores snapshot", async () => {
  const overlayOperations = [
    {
      op: "add",
      path: "/steps/-",
      value: { id: "overlay-step", kind: "info", title: "Tenant step" }
    }
  ];

  await withWorkspaceModules(async () => {
    const { createWorkflowRun } = await import("../workflow-runs.js");

    const { client, getTableRows } = createInMemorySupabase({
      workflow_defs: [
        {
          id: WORKFLOW_DEF_ID,
          key: baseGraph.id,
          version: baseGraph.version,
        title: "Demo",
        dsl_json: baseGraph
      }
    ],
    workflow_def_versions: [
      {
        id: "definition-version-1",
        tenant_org_id: TENANT_ID,
        workflow_def_id: WORKFLOW_DEF_ID,
        version: baseGraph.version,
        checksum: "wf-checksum",
        graph_jsonb: baseGraph,
        rule_ranges: { "rule.deadline": { version: "2.0.0" } },
        template_ranges: { constitution: { version: "3.1.0" } }
      }
    ],
    workflow_pack_versions: [
      {
        id: "overlay-version-1",
        tenant_org_id: TENANT_ID,
        pack_id: "tenant-pack",
        version: "1.2.0",
        checksum: "overlay-checksum",
        overlay_jsonb: overlayOperations
      }
    ],
    rule_versions: [
      {
        id: "rule-version-1",
        tenant_org_id: TENANT_ID,
        rule_id: "rule.deadline",
        version: "2.0.0",
        checksum: "rule-checksum",
        sources: [
          {
            source_key: "cro_open_services",
            snapshot_id: "snapshot-1",
            fingerprint: "fingerprint-1"
          }
        ]
      }
    ],
    template_versions: [
      {
        id: "template-version-1",
        tenant_org_id: TENANT_ID,
        template_id: "constitution",
        version: "3.1.0",
        checksum: "template-checksum",
        storage_ref: "s3://templates/constitution"
      }
    ]
  });

    const overlays: OverlayReference[] = [{ id: "tenant-pack", version: "1.2.0" }];
    const result = await createWorkflowRun(client, {
      workflowKey: baseGraph.id,
      workflowVersion: baseGraph.version,
      subjectOrgId: "00000000-0000-0000-0000-000000000111",
      tenantOrgId: TENANT_ID,
      overlays
    });

    assert.equal(result.run.workflow_def_id, WORKFLOW_DEF_ID);
    assert.ok(result.run.merged_workflow_snapshot);
    assert.deepEqual(result.lockfile.workflowDef, {
      id: baseGraph.id,
      version: baseGraph.version,
      checksum: "wf-checksum"
    });
    assert.equal(result.lockfile.overlays.length, 1);
    assert.equal(result.lockfile.overlays[0]?.id, "tenant-pack");
    assert.equal(result.lockfile.rules["rule.deadline"].sources[0]?.fingerprint, "fingerprint-1");

    const storedRuns = getTableRows("workflow_runs");
    assert.equal(storedRuns.length, 1);
    assert.deepEqual(storedRuns[0]?.merged_workflow_snapshot, result.lockfile);
  });
});

async function withWorkspaceModules<T>(callback: () => Promise<T>): Promise<T> {
  const tempRoot = mkdtempSync(join(tmpdir(), "portal-engine-stub-"));
  const scopeRoot = join(tempRoot, "@airnub");
  const engineRoot = join(scopeRoot, "engine");
  const typesRoot = join(scopeRoot, "types");
  mkdirSync(engineRoot, { recursive: true });
  mkdirSync(typesRoot, { recursive: true });

  const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
  const engineSrc = join(repoRoot, "packages/engine/src/engine.ts");
  const engineTypesSrc = join(repoRoot, "packages/engine/src/types.ts");
  const supabaseTypesSrc = join(repoRoot, "packages/types/src/supabase.ts");

  writeFileSync(
    join(engineRoot, "package.json"),
    JSON.stringify({
      name: "@airnub/engine",
      type: "module",
      exports: {
        "./engine": "./engine.js",
        "./types": "./types.js"
      }
    })
  );
  writeFileSync(join(engineRoot, "engine.js"), `export * from ${JSON.stringify(pathToFileURL(engineSrc).href)};`);
  writeFileSync(join(engineRoot, "types.js"), `export * from ${JSON.stringify(pathToFileURL(engineTypesSrc).href)};`);

  writeFileSync(
    join(typesRoot, "package.json"),
    JSON.stringify({
      name: "@airnub/types",
      type: "module",
      exports: {
        "./supabase": "./supabase.js"
      }
    })
  );
  writeFileSync(join(typesRoot, "supabase.js"), `export * from ${JSON.stringify(pathToFileURL(supabaseTypesSrc).href)};`);

  const previousNodePath = process.env.NODE_PATH;
  process.env.NODE_PATH = tempRoot + (previousNodePath ? `${delimiter}${previousNodePath}` : "");
  Module._initPaths();

  try {
    return await callback();
  } finally {
    process.env.NODE_PATH = previousNodePath;
    Module._initPaths();
    rmSync(tempRoot, { recursive: true, force: true });
  }
}
