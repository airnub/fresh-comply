import { createHash } from "node:crypto";
import jsonPatch from "fast-json-patch";
import {
  type MaterializeContext,
  type MaterializedRun,
  type MaterializeDataSource,
  type OverlayPatch,
  type OverlayReference,
  type RuleSourceSnapshot,
  type RuleVersionRecord,
  type RuleVerificationEvidence,
  type SourceRecord,
  StepDef,
  type StepExecution,
  type TemplateVersionRecord,
  type WebhookStepExecution,
  type WebsocketStepExecution,
  type WorkflowDefinitionVersionRecord,
  WorkflowDSL,
  type WorkflowLockfile,
  type WorkflowOverlayVersionRecord,
  type VerificationResult,
  type VerificationSourceEvidence
} from "./types.js";

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

function ensure<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

function cloneRuleSource(source: RuleSourceSnapshot): RuleSourceSnapshot {
  return {
    sourceKey: source.sourceKey,
    snapshotId: source.snapshotId,
    fingerprint: source.fingerprint
  } satisfies RuleSourceSnapshot;
}

function normaliseOverlayPatch(record: WorkflowOverlayVersionRecord): OverlayPatch {
  const operations = record.patch.operations.map((operation) => ({ ...operation }));
  if (record.patch.source) {
    return { operations, source: record.patch.source };
  }
  return { operations, source: record.overlayId };
}

function requireDataSource(context: MaterializeContext | undefined): MaterializeDataSource {
  if (!context?.data) {
    throw new Error("materialize requires a data source");
  }
  return context.data;
}

export async function materialize(
  defId: string,
  defVersion: string,
  overlays: OverlayReference[] = [],
  context?: MaterializeContext
): Promise<MaterializedRun> {
  const dataSource = requireDataSource(context);

  const definition = ensure(
    await dataSource.getWorkflowDefinitionVersion(defId, defVersion),
    `Workflow definition ${defId}@${defVersion} not found`
  );

  const overlayVersions = await Promise.all(
    overlays.map(async (ref) =>
      ensure(
        await dataSource.getOverlayVersion(ref),
        `Overlay ${ref.id}@${ref.version} not found`
      )
    )
  );

  const merged = materializeWorkflow(definition.graph, {
    overlays: overlayVersions.map((record) => normaliseOverlayPatch(record))
  });

  const ruleVersionEntries = await Promise.all(
    Object.entries(definition.ruleBindings ?? {}).map(async ([ruleId, selector]) => {
      const version = ensure(
        await dataSource.getRuleVersion(ruleId, selector),
        `Rule ${ruleId} version matching selector not found`
      );
      return [ruleId, version] as const;
    })
  );
  const ruleVersions = Object.fromEntries(ruleVersionEntries) as Record<string, RuleVersionRecord>;

  const templateVersionEntries = await Promise.all(
    Object.entries(definition.templateBindings ?? {}).map(async ([templateId, selector]) => {
      const version = ensure(
        await dataSource.getTemplateVersion(templateId, selector),
        `Template ${templateId} version matching selector not found`
      );
      return [templateId, version] as const;
    })
  );
  const templateVersions = Object.fromEntries(templateVersionEntries) as Record<string, TemplateVersionRecord>;

  const lockfile: WorkflowLockfile = {
    workflowDef: {
      id: definition.workflowKey,
      version: definition.version,
      checksum: definition.checksum
    },
    overlays: overlayVersions.map((overlay) => ({
      id: overlay.overlayId,
      version: overlay.version,
      checksum: overlay.checksum
    })),
    rules: Object.fromEntries(
      Object.entries(ruleVersions).map(([ruleId, version]) => [
        ruleId,
        {
          id: ruleId,
          version: version.version,
          checksum: version.checksum,
          sources: version.sources.map(cloneRuleSource)
        }
      ])
    ),
    templates: Object.fromEntries(
      Object.entries(templateVersions).map(([templateId, version]) => [
        templateId,
        {
          id: templateId,
          version: version.version,
          checksum: version.checksum
        }
      ])
    )
  } satisfies WorkflowLockfile;

  return {
    workflow: merged.workflow,
    steps: merged.steps,
    warnings: merged.warnings,
    lockfile,
    definitionVersion: definition,
    overlayVersions,
    ruleVersions,
    templateVersions
  } satisfies MaterializedRun;
}

function canonicalStringify(value: unknown): string {
  return JSON.stringify(value, (_key, input) => {
    if (Array.isArray(input)) {
      return input;
    }
    if (input && typeof input === "object") {
      const sortedKeys = Object.keys(input as Record<string, unknown>).sort();
      return sortedKeys.reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = (input as Record<string, unknown>)[key];
        return acc;
      }, {});
    }
    return input;
  });
}

function defaultFingerprint(records: SourceRecord[]): string {
  const canonical = records.map((record) => canonicalStringify(record)).sort().join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

export interface VerifyOptions {
  fetchSourceRecords: (sourceKey: string) => Promise<SourceRecord[]>;
  buildFingerprint?: (records: SourceRecord[]) => string;
  now?: () => Date;
}

export async function verify(
  lockfile: WorkflowLockfile,
  options: VerifyOptions
): Promise<VerificationResult> {
  if (!options?.fetchSourceRecords) {
    throw new Error("verify requires a fetchSourceRecords implementation");
  }

  const clock = options.now ?? (() => new Date());
  const verifiedAt = clock().toISOString();
  const fingerprint = options.buildFingerprint ?? defaultFingerprint;

  const rules = await Promise.all(
    Object.entries(lockfile.rules).map(async ([ruleId, rule]) => {
      const sources: VerificationSourceEvidence[] = await Promise.all(
        rule.sources.map(async (source) => {
          const records = await options.fetchSourceRecords(source.sourceKey);
          const observedFingerprint = fingerprint(records);
          const matches = observedFingerprint === source.fingerprint;
          const sample = records.slice(0, 5).map((record) => structuredClone(record));
          return {
            sourceKey: source.sourceKey,
            snapshotId: source.snapshotId,
            expectedFingerprint: source.fingerprint,
            observedFingerprint,
            matches,
            fetchedAt: verifiedAt,
            recordCount: records.length,
            sample
          } satisfies VerificationSourceEvidence;
        })
      );

      const stale = sources.some((entry) => !entry.matches);
      const evidence: RuleVerificationEvidence = {
        ruleId,
        version: rule.version,
        checksum: rule.checksum,
        verifiedAt,
        status: stale ? "stale" : "verified",
        sources
      } satisfies RuleVerificationEvidence;
      return [ruleId, evidence] as const;
    })
  );

  return {
    verifiedAt,
    rules: Object.fromEntries(rules)
  } satisfies VerificationResult;
}
