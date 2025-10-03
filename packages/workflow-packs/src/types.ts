import type { WorkflowDefinition } from "@airnub/workflow-core";
import type { Operation } from "fast-json-patch";

export interface WorkflowOverlay {
  workflowId: string;
  patchPath: string;
  operations: Operation[];
}

export interface WorkflowPackManifest {
  name: string;
  version: string;
  description?: string;
  compatibleWithWorkflow: string | string[];
  scopes?: string[];
  overlays: Array<{
    workflow: string;
    patch: string;
  }>;
  i18n?: Record<string, string>;
  docs?: string[];
}

export interface WorkflowPack {
  directory: string;
  manifest: WorkflowPackManifest;
  overlays: WorkflowOverlay[];
  schemaFiles: string[];
  signaturePath?: string;
}

export interface ImpactMap {
  addedSteps: string[];
  removedSteps: string[];
  changedSteps: string[];
}

export interface MergeResult {
  workflow: WorkflowDefinition;
  impactMap: ImpactMap;
  warnings: string[];
}
