import jsonPatch, { type Operation } from "fast-json-patch";
import {
  WorkflowDSL,
  StepDef,
  type StepExecution,
  type WebhookStepExecution,
  type WebsocketStepExecution
} from "./types.js";

export type OverlayPatch = {
  operations: Operation[];
  source?: string;
};

export interface MaterializeOptions {
  overlays?: OverlayPatch[];
}

export interface MaterializeResult {
  workflow: WorkflowDSL;
  steps: StepDef[];
  warnings: string[];
}

function cloneWorkflow(dsl: WorkflowDSL): WorkflowDSL {
  return structuredClone(dsl);
}

function validateGraphIntegrity(workflow: WorkflowDSL): string[] {
  const ids = new Set(workflow.steps.map((step) => step.id));
  const issues: string[] = [];

  for (const step of workflow.steps) {
    for (const requirement of step.requires ?? []) {
      if (!ids.has(requirement)) {
        issues.push(`Step ${step.id} requires missing step ${requirement}`);
      }
    }
  }

  for (const edge of workflow.edges ?? []) {
    if (!ids.has(edge.from)) {
      issues.push(`Edge references missing step ${edge.from}`);
    }
    if (!ids.has(edge.to)) {
      issues.push(`Edge references missing step ${edge.to}`);
    }
  }

  return issues;
}

function validateSecretBindings(workflow: WorkflowDSL): string[] {
  const issues: string[] = [];

  for (const step of workflow.steps) {
    const explicitSecrets = step.secrets && typeof step.secrets === "object" ? step.secrets : undefined;
    const metadataSecrets =
      step.metadata && typeof step.metadata === "object" && "secrets" in step.metadata
        ? ((step.metadata as Record<string, unknown>).secrets as Record<string, { alias?: string; value?: unknown }> | undefined)
        : undefined;
    const secrets = (explicitSecrets ?? metadataSecrets ?? {}) as Record<string, { alias?: string; value?: unknown }>;

    for (const [key, binding] of Object.entries(secrets)) {
      if (!binding || typeof binding !== "object") {
        issues.push(`Step ${step.id} secret ${key} must reference an alias object.`);
        continue;
      }

      if ("value" in binding || (binding as Record<string, unknown>).value) {
        issues.push(`Step ${step.id} secret ${key} must not embed a raw value.`);
      }

      if (typeof binding.alias !== "string" || binding.alias.trim().length === 0) {
        issues.push(`Step ${step.id} secret ${key} must provide a non-empty alias.`);
      }
    }
  }

  return issues;
}

function isAlias(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !value.includes("://");
}

function validateWebhookExecution(stepId: string, execution: WebhookStepExecution, issues: string[]) {
  const config = execution.config;
  if (!isAlias(config.urlAlias)) {
    issues.push(`Step ${stepId} webhook config must reference a urlAlias secret.`);
  }
  if ("url" in (config as Record<string, unknown>)) {
    issues.push(`Step ${stepId} webhook config must not include a raw url; use urlAlias instead.`);
  }
  if (config.tokenAlias && !isAlias(config.tokenAlias)) {
    issues.push(`Step ${stepId} webhook config tokenAlias must be a secret alias.`);
  }
  if ((config as Record<string, unknown>).token) {
    issues.push(`Step ${stepId} webhook config must not include a raw token; use tokenAlias.`);
  }
  if (config.signing) {
    if (config.signing.algo !== "hmac-sha256") {
      issues.push(`Step ${stepId} webhook config uses unsupported signing algorithm ${config.signing.algo}.`);
    }
    if (!isAlias(config.signing.secretAlias)) {
      issues.push(`Step ${stepId} webhook config signing.secretAlias must be a secret alias.`);
    }
  }
}

function validateWebsocketExecution(stepId: string, execution: WebsocketStepExecution, issues: string[]) {
  const config = execution.config;
  if (!isAlias(config.urlAlias)) {
    issues.push(`Step ${stepId} websocket config must reference a urlAlias secret.`);
  }
  if (config.tokenAlias && !isAlias(config.tokenAlias)) {
    issues.push(`Step ${stepId} websocket config tokenAlias must be a secret alias.`);
  }
  if ((config as Record<string, unknown>).token) {
    issues.push(`Step ${stepId} websocket config must not include a raw token; use tokenAlias.`);
  }
}

function validateExecutionMetadata(workflow: WorkflowDSL): string[] {
  const issues: string[] = [];

  for (const step of workflow.steps) {
    const execution = step.execution as StepExecution | undefined;
    if (!execution) {
      continue;
    }

    switch (execution.mode) {
      case "external:webhook":
        validateWebhookExecution(step.id, execution, issues);
        break;
      case "external:websocket":
        validateWebsocketExecution(step.id, execution, issues);
        break;
      default:
        break;
    }
  }

  return issues;
}

export function materializeWorkflow(dsl: WorkflowDSL, options: MaterializeOptions = {}): MaterializeResult {
  const overlays = options.overlays ?? [];
  let workflow = cloneWorkflow(dsl);

  for (const overlay of overlays) {
    if (!overlay.operations || overlay.operations.length === 0) {
      continue;
    }

    const result = jsonPatch.applyPatch(cloneWorkflow(workflow), overlay.operations, true, false);
    if (!result.newDocument) {
      throw new Error(`Failed to apply overlay patch${overlay.source ? ` from ${overlay.source}` : ""}`);
    }
    workflow = result.newDocument as WorkflowDSL;
  }

  const graphIssues = validateGraphIntegrity(workflow);
  if (graphIssues.length > 0) {
    throw new Error(graphIssues.join("\n"));
  }

  const secretIssues = validateSecretBindings(workflow);
  if (secretIssues.length > 0) {
    throw new Error(secretIssues.join("\n"));
  }

  const executionIssues = validateExecutionMetadata(workflow);
  if (executionIssues.length > 0) {
    throw new Error(executionIssues.join("\n"));
  }

  return {
    workflow,
    steps: workflow.steps,
    warnings: [],
  };
}

export function materializeSteps(dsl: WorkflowDSL, overlays: OverlayPatch[] = []): StepDef[] {
  return materializeWorkflow(dsl, { overlays }).steps;
}
