import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  materialize,
  verify
} from "../engine.js";
import type {
  MaterializeContext,
  MaterializeDataSource,
  OverlayPatch,
  OverlayReference,
  RuleVersionRecord,
  TemplateVersionRecord,
  WorkflowDefinitionVersionRecord,
  WorkflowDSL,
  WorkflowLockfile,
  WorkflowOverlayVersionRecord
} from "../types.js";

const baseWorkflow: WorkflowDSL = {
  id: "setup-nonprofit",
  version: "1.0.0",
  title: "Demo",
  steps: [
    {
      id: "base-step",
      kind: "info",
      title: "Collect documents",
      verify: [{ id: "rule.deadline" }]
    }
  ]
};

const ruleVersion: RuleVersionRecord = {
  id: "rule-version-1",
  ruleId: "rule.deadline",
  version: "2.0.0",
  checksum: "rule-checksum",
  sources: [
    { sourceKey: "cro_open_services", snapshotId: "snapshot-1", fingerprint: "fp-cro" }
  ]
};

const templateVersion: TemplateVersionRecord = {
  id: "template-version-1",
  templateId: "constitution",
  version: "3.1.0",
  checksum: "template-checksum"
};

const overlayPatch: OverlayPatch = {
  operations: [
    {
      op: "add",
      path: "/steps/-",
      value: { id: "overlay-step", kind: "info", title: "Tenant introduction" }
    }
  ],
  source: "tenant-pack"
};

const definitionVersion: WorkflowDefinitionVersionRecord = {
  id: "definition-version-1",
  workflowDefId: "workflow-def-row-1",
  workflowKey: baseWorkflow.id,
  version: baseWorkflow.version,
  checksum: "definition-checksum",
  graph: baseWorkflow,
  ruleBindings: { "rule.deadline": { version: "2.0.0" } },
  templateBindings: { constitution: { version: "3.1.0" } }
};

const overlayVersion: WorkflowOverlayVersionRecord = {
  id: "overlay-version-1",
  overlayId: "tenant-pack",
  version: "1.2.0",
  checksum: "overlay-checksum",
  patch: overlayPatch
};

const stubDataSource: MaterializeDataSource = {
  async getWorkflowDefinitionVersion(defId: string, version: string) {
    if (defId === baseWorkflow.id && version === baseWorkflow.version) {
      return definitionVersion;
    }
    return undefined;
  },
  async getOverlayVersion(ref: OverlayReference) {
    if (ref.id === overlayVersion.overlayId && ref.version === overlayVersion.version) {
      return overlayVersion;
    }
    return undefined;
  },
  async getRuleVersion(ruleId: string, _selector: unknown) {
    return ruleId === ruleVersion.ruleId ? ruleVersion : undefined;
  },
  async getTemplateVersion(templateId: string, _selector: unknown) {
    return templateId === templateVersion.templateId ? templateVersion : undefined;
  }
};

test("materialize produces a lockfile with checksums and overlays", async () => {
  const context: MaterializeContext = { data: stubDataSource };
  const overlays: OverlayReference[] = [{ id: "tenant-pack", version: "1.2.0" }];
  const result = await materialize(baseWorkflow.id, baseWorkflow.version, overlays, context);

  assert.equal(result.lockfile.workflowDef.id, baseWorkflow.id);
  assert.equal(result.lockfile.workflowDef.version, baseWorkflow.version);
  assert.equal(result.lockfile.workflowDef.checksum, "definition-checksum");
  assert.deepEqual(result.lockfile.overlays, [
    { id: "tenant-pack", version: "1.2.0", checksum: "overlay-checksum" }
  ]);
  assert.deepEqual(result.lockfile.rules["rule.deadline"], {
    id: "rule.deadline",
    version: "2.0.0",
    checksum: "rule-checksum",
    sources: ruleVersion.sources
  });
  assert.deepEqual(result.lockfile.templates.constitution, {
    id: "constitution",
    version: "3.1.0",
    checksum: "template-checksum"
  });
  assert.ok(result.steps.find((step) => step.id === "overlay-step"));
});

function computeFingerprint(records: Record<string, unknown>[]): string {
  const canonical = records
    .map((record) =>
      JSON.stringify(record, (_key, value) => {
        if (Array.isArray(value)) {
          return value;
        }
        if (value && typeof value === "object") {
          const sorted = Object.keys(value as Record<string, unknown>).sort();
          return sorted.reduce<Record<string, unknown>>((acc, key) => {
            acc[key] = (value as Record<string, unknown>)[key];
            return acc;
          }, {});
        }
        return value;
      })
    )
    .sort()
    .join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

test("verify recomputes fingerprints and flags stale sources", async () => {
  const matchingRecords = [{ id: 1, name: "A" }];
  const staleRecords = [{ id: 2, name: "B" }];
  const lockfile: WorkflowLockfile = {
    workflowDef: { id: "wf", version: "1.0.0", checksum: "wf-checksum" },
    overlays: [],
    rules: {
      "rule.deadline": {
        id: "rule.deadline",
        version: "2.0.0",
        checksum: "rule-checksum",
        sources: [
          {
            sourceKey: "cro_open_services",
            snapshotId: "snapshot-1",
            fingerprint: computeFingerprint(matchingRecords)
          },
          {
            sourceKey: "charities_ckan",
            snapshotId: "snapshot-2",
            fingerprint: "stale-fingerprint"
          }
        ]
      }
    },
    templates: {}
  };

  const result = await verify(lockfile, {
    fetchSourceRecords: async (sourceKey) => {
      if (sourceKey === "cro_open_services") {
        return matchingRecords;
      }
      if (sourceKey === "charities_ckan") {
        return staleRecords;
      }
      throw new Error(`Unexpected source ${sourceKey}`);
    },
    buildFingerprint: computeFingerprint,
    now: () => new Date("2024-01-02T03:04:05Z")
  });

  assert.equal(result.verifiedAt, "2024-01-02T03:04:05.000Z");
  const rule = result.rules["rule.deadline"];
  assert.equal(rule.status, "stale");
  assert.equal(rule.sources.length, 2);
  const [first, second] = rule.sources;
  assert.equal(first.matches, true);
  assert.equal(first.observedFingerprint, first.expectedFingerprint);
  assert.equal(first.recordCount, 1);
  assert.deepEqual(first.sample, matchingRecords);
  assert.equal(second.matches, false);
  assert.notEqual(second.observedFingerprint, second.expectedFingerprint);
});
