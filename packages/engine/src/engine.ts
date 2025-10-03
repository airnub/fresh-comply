import { applyPatch, type Operation } from "fast-json-patch";
import { WorkflowDSL, StepDef } from "./types.js";

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

export function materializeWorkflow(dsl: WorkflowDSL, options: MaterializeOptions = {}): MaterializeResult {
  const overlays = options.overlays ?? [];
  let workflow = cloneWorkflow(dsl);

  for (const overlay of overlays) {
    if (!overlay.operations || overlay.operations.length === 0) {
      continue;
    }

    const result = applyPatch(cloneWorkflow(workflow), overlay.operations, true, false);
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

  return {
    workflow,
    steps: workflow.steps,
    warnings: [],
  };
}

export function materializeSteps(dsl: WorkflowDSL, overlays: OverlayPatch[] = []): StepDef[] {
  return materializeWorkflow(dsl, { overlays }).steps;
}
