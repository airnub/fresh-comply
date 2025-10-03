import assert from "node:assert/strict";
import test from "node:test";
import type {
  TemporalStepExecution,
  WebhookStepExecution,
  WebsocketStepExecution
} from "@airnub/engine/types";
import {
  normaliseExecution,
  sanitizeTemporalExecution,
  sanitizeWebhookExecution,
  sanitizeWebsocketExecution
} from "../tenant-overlay-execution";

test("normaliseExecution merges temporal config fields", () => {
  const legacy: TemporalStepExecution = {
    mode: "temporal",
    config: { workflow: "legacyWorkflow", taskQueue: "legacyQueue" }
  };

  const normalised = normaliseExecution(legacy) as TemporalStepExecution;
  assert.equal(normalised.mode, "temporal");
  assert.equal(normalised.workflow, "legacyWorkflow");
  assert.equal(normalised.taskQueue, "legacyQueue");
  assert.equal(normalised.config?.workflow, "legacyWorkflow");
  assert.equal(normalised.config?.taskQueue, "legacyQueue");
});

test("sanitizeTemporalExecution drops empty overrides", () => {
  const execution: TemporalStepExecution = {
    mode: "temporal",
    workflow: "  workflow-name  ",
    taskQueue: "   ",
    defaultTaskQueue: " default-queue "
  };

  const sanitized = sanitizeTemporalExecution(execution);
  assert.equal(sanitized.workflow, "workflow-name");
  assert.ok(!("taskQueue" in sanitized));
  assert.equal(sanitized.defaultTaskQueue, "default-queue");
  assert.equal(sanitized.config?.defaultTaskQueue, "default-queue");
});

test("sanitizeWebhookExecution trims aliases and omits blanks", () => {
  const execution: WebhookStepExecution = {
    mode: "external:webhook",
    config: {
      method: "POST",
      urlAlias: " webhook.base ",
      tokenAlias: "  webhook.token  ",
      path: " /callback ",
      headers: { "X-Test": "true" },
      signing: { algo: "hmac-sha256", secretAlias: " signature " }
    }
  };

  const sanitized = sanitizeWebhookExecution(execution);
  assert.equal(sanitized.config.urlAlias, "webhook.base");
  assert.equal(sanitized.config.tokenAlias, "webhook.token");
  assert.equal(sanitized.config.path, "/callback");
  assert.ok(sanitized.config.signing);
  assert.equal(sanitized.config.signing?.secretAlias, "signature");

  const withoutSigning: WebhookStepExecution = {
    mode: "external:webhook",
    config: {
      method: "POST",
      urlAlias: " webhook.base ",
      signing: { algo: "hmac-sha256", secretAlias: "   " }
    }
  };

  const sanitizedNoSigning = sanitizeWebhookExecution(withoutSigning);
  assert.ok(!sanitizedNoSigning.config.signing);
});

test("sanitizeWebsocketExecution retains provided overrides", () => {
  const execution: WebsocketStepExecution = {
    mode: "external:websocket",
    config: {
      urlAlias: " websocket.base ",
      tokenAlias: "  websocket.token  ",
      messageSchema: " schema.json ",
      temporalWorkflow: " externalJobWorkflow ",
      defaultTaskQueue: "  tenant-queue  ",
      taskQueueOverride: "  override-queue  "
    }
  };

  const sanitized = sanitizeWebsocketExecution(execution);
  assert.equal(sanitized.config.urlAlias, "websocket.base");
  assert.equal(sanitized.config.tokenAlias, "websocket.token");
  assert.equal(sanitized.config.messageSchema, "schema.json");
  assert.equal(sanitized.config.temporalWorkflow, "externalJobWorkflow");
  assert.equal(sanitized.config.defaultTaskQueue, "tenant-queue");
  assert.equal(sanitized.config.taskQueueOverride, "override-queue");
});
