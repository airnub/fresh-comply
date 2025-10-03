import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import YAML from "yaml";
import jsonPatch from "fast-json-patch";
import { validateWorkflow, type WorkflowDefinition } from "@airnub/workflow-core";
import type { Operation } from "fast-json-patch";
import type {
  WorkflowPack,
  WorkflowPackManifest,
  WorkflowOverlay,
  ImpactMap,
  MergeResult
} from "./types";

const { applyPatch } = jsonPatch;

const SIGNATURE_FILE = "signature.txt";

export class WorkflowPackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowPackError";
  }
}

function readJSON(path: string) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    throw new WorkflowPackError(`Failed to parse JSON file at ${path}: ${(error as Error).message}`);
  }
}

function walkDirectory(dir: string, prefix = dir): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...walkDirectory(fullPath, prefix));
    } else {
      files.push(relative(prefix, fullPath));
    }
  }
  return files;
}

export function computePackChecksum(directory: string): string {
  const hash = createHash("sha256");
  const files = walkDirectory(directory).filter((file) => file !== SIGNATURE_FILE);
  files.sort();
  for (const file of files) {
    const fullPath = resolve(directory, file);
    hash.update(file);
    hash.update(readFileSync(fullPath));
  }
  return hash.digest("hex");
}

function ensureManifest(manifest: unknown): asserts manifest is WorkflowPackManifest {
  if (!manifest || typeof manifest !== "object") {
    throw new WorkflowPackError("Pack manifest is empty or invalid");
  }

  const value = manifest as WorkflowPackManifest;
  if (!value.name || !value.version) {
    throw new WorkflowPackError("Pack manifest must include name and version");
  }

  if (!value.overlays || value.overlays.length === 0) {
    throw new WorkflowPackError("Pack manifest must declare at least one overlay");
  }
}

export function loadPackFromDirectory(directory: string): WorkflowPack {
  const manifestPath = resolve(directory, "pack.yaml");
  const manifestContent = readFileSync(manifestPath, "utf-8");
  const manifest = YAML.parse(manifestContent) as WorkflowPackManifest;
  ensureManifest(manifest);

  const overlays: WorkflowOverlay[] = manifest.overlays.map((overlay) => {
    const patchPath = resolve(directory, overlay.patch);
    const operations = readJSON(patchPath) as Operation[];
    return {
      workflowId: overlay.workflow,
      patchPath,
      operations
    };
  });

  const schemaDir = resolve(directory, "schemas");
  let schemaFiles: string[] = [];
  try {
    schemaFiles = walkDirectory(schemaDir, schemaDir).map((file) => `schemas/${file}`);
  } catch (error) {
    // ignore missing schema dir
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const signaturePath = resolve(directory, SIGNATURE_FILE);
  const hasSignature = (() => {
    try {
      statSync(signaturePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw error;
    }
  })();

  return {
    directory,
    manifest,
    overlays,
    schemaFiles,
    signaturePath: hasSignature ? signaturePath : undefined
  };
}

function cloneWorkflow(workflow: WorkflowDefinition): WorkflowDefinition {
  return structuredClone(workflow);
}

function validateGraph(workflow: WorkflowDefinition): string[] {
  const ids = new Set(workflow.steps.map((step) => step.id));
  const errors: string[] = [];
  for (const edge of workflow.edges ?? []) {
    if (!ids.has(edge.from)) {
      errors.push(`Edge references unknown step: ${edge.from} -> ${edge.to}`);
    }
    if (!ids.has(edge.to)) {
      errors.push(`Edge references unknown step: ${edge.to}`);
    }
  }
  return errors;
}

function diffSteps(before: WorkflowDefinition, after: WorkflowDefinition): ImpactMap {
  const beforeSteps = new Map(before.steps.map((step) => [step.id, step]));
  const afterSteps = new Map(after.steps.map((step) => [step.id, step]));

  const addedSteps: string[] = [];
  const removedSteps: string[] = [];
  const changedSteps: string[] = [];

  for (const [id, step] of afterSteps.entries()) {
    if (!beforeSteps.has(id)) {
      addedSteps.push(id);
    } else {
      const previous = beforeSteps.get(id)!;
      if (JSON.stringify(previous) !== JSON.stringify(step)) {
        changedSteps.push(id);
      }
    }
  }

  for (const id of beforeSteps.keys()) {
    if (!afterSteps.has(id)) {
      removedSteps.push(id);
    }
  }

  return { addedSteps, removedSteps, changedSteps };
}

function ensureRequiredStepsRemain(base: WorkflowDefinition, merged: WorkflowDefinition): string[] {
  const requiredSteps = base.steps.filter((step) => step.required).map((step) => step.id);
  const mergedIds = new Set(merged.steps.map((step) => step.id));
  const missing = requiredSteps.filter((id) => !mergedIds.has(id));
  if (missing.length === 0) {
    return [];
  }
  return missing.map((id) => `Required step "${id}" from base workflow is missing after applying overlays.`);
}

function ensureSchemaReferences(pack: WorkflowPack, workflow: WorkflowDefinition): string[] {
  const available = new Set(pack.schemaFiles);
  const errors: string[] = [];

  for (const step of workflow.steps) {
    const schemaPath = step.execution?.input_schema;
    if (!schemaPath) {
      continue;
    }
    if (/^https?:\/\//.test(schemaPath)) {
      continue; // external schema
    }
    if (schemaPath.startsWith("schemas/") && !available.has(schemaPath)) {
      errors.push(`Step ${step.id} references missing schema ${schemaPath}`);
    }
  }

  return errors;
}

export function mergeWorkflowWithPack(
  base: WorkflowDefinition,
  pack: WorkflowPack
): MergeResult {
  const overlays = pack.overlays.filter((overlay) => overlay.workflowId === base.id);
  if (overlays.length === 0) {
    throw new WorkflowPackError(`Pack ${pack.manifest.name} has no overlay for workflow ${base.id}`);
  }

  let next = cloneWorkflow(base);
  for (const overlay of overlays) {
    const result = applyPatch(next, overlay.operations, true, false);
    if (result.newDocument) {
      next = result.newDocument as WorkflowDefinition;
    } else {
      throw new WorkflowPackError(`Failed to apply overlay ${overlay.patchPath}`);
    }
  }

  const validation = validateWorkflow(next);
  const graphIssues = validateGraph(next);
  const requiredIssues = ensureRequiredStepsRemain(base, next);
  const schemaIssues = ensureSchemaReferences(pack, next);

  const warnings = [...graphIssues, ...schemaIssues];
  const errors = [...requiredIssues, ...(validation.valid ? [] : validation.errors)];

  if (errors.length > 0) {
    throw new WorkflowPackError(errors.join("\n"));
  }

  return {
    workflow: next,
    impactMap: diffSteps(base, next),
    warnings
  };
}

export function mergeWorkflowWithPacks(
  base: WorkflowDefinition,
  packs: WorkflowPack[]
): MergeResult {
  let result: MergeResult = { workflow: cloneWorkflow(base), impactMap: { addedSteps: [], removedSteps: [], changedSteps: [] }, warnings: [] };
  for (const pack of packs) {
    const merge = mergeWorkflowWithPack(result.workflow, pack);
    result = {
      workflow: merge.workflow,
      impactMap: {
        addedSteps: [...new Set([...result.impactMap.addedSteps, ...merge.impactMap.addedSteps])],
        removedSteps: [...new Set([...result.impactMap.removedSteps, ...merge.impactMap.removedSteps])],
        changedSteps: [...new Set([...result.impactMap.changedSteps, ...merge.impactMap.changedSteps])]
      },
      warnings: [...result.warnings, ...merge.warnings]
    };
  }
  return result;
}

export function loadWorkflowFromFile(path: string): WorkflowDefinition {
  const filePath = resolve(path);
  const content = readFileSync(filePath, "utf-8");
  const workflow = YAML.parse(content) as WorkflowDefinition;
  const validation = validateWorkflow(workflow);
  if (!validation.valid) {
    throw new WorkflowPackError(`Workflow at ${path} failed validation:\n${validation.errors.join("\n")}`);
  }
  return workflow;
}

export function verifyPackSignature(pack: WorkflowPack): boolean {
  if (!pack.signaturePath) {
    return false;
  }
  const signature = readFileSync(pack.signaturePath, "utf-8").trim();
  const checksum = computePackChecksum(pack.directory);
  return signature === checksum;
}

export * from "./types";
