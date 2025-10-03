import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import type { Operation } from "fast-json-patch";
import { loadDSL } from "../dsl.js";
import { materializeWorkflow } from "../engine.js";
import type { StepDef, WorkflowDSL } from "../types.js";

test("loadDSL preserves external execution metadata", () => {
  const dir = mkdtempSync(join(tmpdir(), "fc-dsl-"));
  const filePath = join(dir, "workflow.yaml");
  const yaml = `id: demo-workflow\nversion: 1.0.0\ntitle: Demo\nsteps:\n  - id: webhook-step\n    kind: action\n    title: Demo webhook\n    execution:\n      mode: external:webhook\n      config:\n        method: POST\n        urlAlias: secrets.webhook.base\n        tokenAlias: secrets.webhook.token\n  - id: websocket-step\n    kind: tool.call\n    title: Demo websocket\n    execution:\n      mode: external:websocket\n      config:\n        urlAlias: secrets.websocket.base\n        temporalWorkflow: externalJobWorkflow\n`;
  writeFileSync(filePath, yaml, "utf8");

  const workflow = loadDSL(filePath);
  const webhook = workflow.steps[0]?.execution;
  const websocket = workflow.steps[1]?.execution;

  assert.equal(webhook?.mode, "external:webhook");
  assert.equal(websocket?.mode, "external:websocket");
});

test("materializeWorkflow validates webhook execution aliases", () => {
  const workflow: WorkflowDSL = {
    id: "wf-alias",
    version: "1",
    steps: [
      {
        id: "external-webhook",
        kind: "action",
        title: "Webhook",
        execution: {
          mode: "external:webhook",
          config: {
            method: "POST",
            urlAlias: "secrets.webhook.base",
            tokenAlias: "secrets.webhook.token"
          }
        }
      } satisfies StepDef
    ]
  };

  const result = materializeWorkflow(workflow);
  assert.equal(result.steps[0]?.execution?.mode, "external:webhook");

  const invalid: WorkflowDSL = {
    ...workflow,
    steps: [
      {
        ...workflow.steps[0]!,
        execution: {
          mode: "external:webhook",
          config: {
            method: "POST",
            urlAlias: "https://example.com/webhook"
          }
        }
      } satisfies StepDef
    ]
  };

  assert.throws(
    () => materializeWorkflow(invalid),
    /must reference a urlAlias secret/
  );

  const literalToken: WorkflowDSL = {
    ...workflow,
    steps: [
      {
        ...workflow.steps[0]!,
        execution: {
          mode: "external:webhook",
          config: {
            method: "POST",
            urlAlias: "secrets.webhook.base",
            // @ts-expect-error intentional invalid config for validation
            token: "literal"
          }
        }
      } satisfies StepDef
    ]
  };

  assert.throws(
    () => materializeWorkflow(literalToken),
    /must not include a raw token/
  );
});

test("materializeWorkflow merges overlays with external websocket execution", () => {
  const workflow: WorkflowDSL = {
    id: "wf-overlay",
    version: "1",
    steps: [
      {
        id: "base-step",
        kind: "info",
        title: "Base"
      } satisfies StepDef
    ]
  };

  const overlayOperations: Operation[] = [
    {
      op: "add",
      path: "/steps/-",
      value: {
        id: "websocket-step",
        kind: "tool.call",
        title: "External stream",
        execution: {
          mode: "external:websocket",
          config: {
            urlAlias: "secrets.websocket.base",
            temporalWorkflow: "externalJobWorkflow"
          }
        }
      }
    }
  ];

  const materialized = materializeWorkflow(workflow, {
    overlays: [{ operations: overlayOperations }]
  });

  const websocketStep = materialized.steps.find((step) => step.id === "websocket-step");
  assert.ok(websocketStep, "websocket step should be present after overlay merge");
  assert.equal(websocketStep?.execution?.mode, "external:websocket");
});
