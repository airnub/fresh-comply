import assert from "node:assert/strict";
import test from "node:test";
import type { Operation } from "fast-json-patch";

import { mergeWorkflowWithPack } from "./index.js";
import type { WorkflowPack } from "./types.js";
import type { WorkflowDefinition } from "@airnub/workflow-core";

test("mergeWorkflowWithPack accepts execution overlay metadata", () => {
  const baseWorkflow: WorkflowDefinition = {
    id: "setup-nonprofit-ie",
    version: "2025.10.0",
    title: "Setup Nonprofit IE",
    steps: [
      {
        id: "revenue-chy-exemption",
        kind: "action",
        title: "Revenue CHY exemption"
      },
      {
        id: "rbo",
        kind: "action",
        title: "RBO beneficial ownership",
        requires: ["revenue-chy-exemption"]
      },
      {
        id: "board-resolution",
        kind: "action",
        title: "Board resolution",
        requires: ["rbo"]
      }
    ]
  };

  const overlayOperations: Operation[] = [
    {
      op: "add",
      path: "/steps/1",
      value: {
        id: "tenantx-ml-screening",
        kind: "action",
        title: "Machine learning screening (Tenant X)",
        execution: {
          mode: "temporal",
          workflow: "tenantX.mlScreening",
          taskQueue: "tenant-x-main",
          input_schema: "schemas/ml-screening.json",
          permissions: ["org:member"],
          secret_aliases: ["secrets.mlApiKey"],
          secrets: ["secrets.legacyMlKey"],
          externalWebhook: {
            urlAlias: "secrets.sysY.callback"
          }
        }
      }
    },
    {
      op: "replace",
      path: "/steps/2/requires",
      value: ["tenantx-ml-screening"]
    },
    {
      op: "add",
      path: "/steps/3",
      value: {
        id: "tenantx-policy-attest",
        kind: "action",
        title: "Board policy attestation (Tenant X)",
        execution: {
          mode: "manual",
          input_schema: "schemas/policy-attest.json",
          permissions: ["org:member"]
        },
        requires: ["tenantx-ml-screening"]
      }
    },
    {
      op: "replace",
      path: "/steps/4/requires",
      value: ["tenantx-policy-attest"]
    }
  ];

  const pack: WorkflowPack = {
    directory: "/tmp/tenantx-pack",
    manifest: {
      name: "tenantx",
      version: "1.0.0",
      compatibleWithWorkflow: ["setup-nonprofit-ie@^2025.10"],
      overlays: [
        {
          workflow: baseWorkflow.id,
          patch: "overlay.patch.json"
        }
      ]
    },
    overlays: [
      {
        workflowId: baseWorkflow.id,
        patchPath: "overlay.patch.json",
        operations: overlayOperations
      }
    ],
    schemaFiles: [
      "schemas/ml-screening.json",
      "schemas/policy-attest.json"
    ]
  };

  const result = mergeWorkflowWithPack(baseWorkflow, pack);
  const mlStep = result.workflow.steps.find((step) => step.id === "tenantx-ml-screening");
  const policyStep = result.workflow.steps.find((step) => step.id === "tenantx-policy-attest");

  assert.ok(mlStep, "ML screening step should be present after merge");
  assert.deepEqual(mlStep?.execution?.secret_aliases, ["secrets.mlApiKey"]);
  assert.equal(mlStep?.execution?.input_schema, "schemas/ml-screening.json");
  assert.ok(policyStep, "Policy attestation step should be present after merge");
  assert.equal(policyStep?.execution?.permissions?.includes("org:member"), true);
});
