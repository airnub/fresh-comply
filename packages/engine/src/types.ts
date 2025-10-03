import type { Operation } from "fast-json-patch";

export type NodeKind = "question" | "info" | "action" | "upload" | "doc.generate" | "tool.call" | "verify" | "schedule" | "review";
export type RuleRef = { id: string };
export type ManualStepExecution = {
  mode: "manual";
};

export type TemporalExecutionConfig = {
  workflow?: string;
  taskQueue?: string;
  defaultTaskQueue?: string;
  tenantId?: string;
};

export type TemporalStepExecution = {
  mode: "temporal";
  workflow?: string;
  taskQueue?: string;
  defaultTaskQueue?: string;
  tenantId?: string;
  config?: TemporalExecutionConfig;
};

export type WebhookSigningConfig = {
  algo: "hmac-sha256";
  secretAlias: string;
};

export type WebhookExecutionConfig = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  urlAlias: string;
  tokenAlias?: string;
  path?: string;
  headers?: Record<string, string>;
  signing?: WebhookSigningConfig;
};

export type WebhookStepExecution = {
  mode: "external:webhook";
  config: WebhookExecutionConfig;
};

export type WebsocketExecutionConfig = {
  urlAlias: string;
  tokenAlias?: string;
  messageSchema?: string;
  temporalWorkflow?: string;
  defaultTaskQueue?: string;
  taskQueueOverride?: string;
  tenantId?: string;
};

export type WebsocketStepExecution = {
  mode: "external:websocket";
  config: WebsocketExecutionConfig;
};

export type StepExecution =
  | ManualStepExecution
  | TemporalStepExecution
  | WebhookStepExecution
  | WebsocketStepExecution;

export type StepSecretBinding = {
  alias: string;
  metadata?: Record<string, unknown>;
};

export type StepDef = {
  id: string;
  kind: NodeKind;
  title: string;
  requires?: string[];
  verify?: RuleRef[];
  execution?: StepExecution;
  required?: boolean;
  stepType?: string;
  input?: Record<string, unknown>;
  secrets?: Record<string, StepSecretBinding>;
  metadata?: Record<string, unknown>;
};

export type WorkflowEdge = { from: string; to: string; condition?: string };

export type WorkflowDSL = {
  id: string;
  version: string;
  title?: string;
  questions?: any[];
  branches?: any[];
  steps: StepDef[];
  edges?: WorkflowEdge[];
  metadata?: Record<string, unknown>;
};

export type OverlayPatch = {
  operations: Operation[];
  source?: string;
};

export type RuleVersionSelector = string | { version: string } | { range: string };

export type TemplateVersionSelector = string | { version: string } | { range: string };

export type RuleSourceSnapshot = {
  sourceKey: string;
  snapshotId: string;
  fingerprint: string;
};

export type RuleVersionRecord = {
  id: string;
  ruleId: string;
  version: string;
  checksum: string;
  sources: RuleSourceSnapshot[];
};

export type TemplateVersionRecord = {
  id: string;
  templateId: string;
  version: string;
  checksum: string;
};

export type OverlayReference = {
  id: string;
  version: string;
};

export type WorkflowOverlayVersionRecord = {
  id: string;
  overlayId: string;
  version: string;
  checksum: string;
  patch: OverlayPatch;
};

export type WorkflowDefinitionVersionRecord = {
  id: string;
  workflowDefId: string;
  workflowKey: string;
  version: string;
  checksum: string;
  graph: WorkflowDSL;
  ruleBindings: Record<string, RuleVersionSelector>;
  templateBindings: Record<string, TemplateVersionSelector>;
};

export type WorkflowLockfileWorkflow = {
  id: string;
  version: string;
  checksum: string;
};

export type WorkflowLockfileOverlay = {
  id: string;
  version: string;
  checksum: string;
};

export type WorkflowLockfileRule = {
  id: string;
  version: string;
  checksum: string;
  sources: RuleSourceSnapshot[];
};

export type WorkflowLockfileTemplate = {
  id: string;
  version: string;
  checksum: string;
};

export type WorkflowLockfile = {
  workflowDef: WorkflowLockfileWorkflow;
  overlays: WorkflowLockfileOverlay[];
  rules: Record<string, WorkflowLockfileRule>;
  templates: Record<string, WorkflowLockfileTemplate>;
};

export type MaterializeDataSource = {
  getWorkflowDefinitionVersion(
    defId: string,
    version: string
  ): Promise<WorkflowDefinitionVersionRecord | undefined>;
  getOverlayVersion(ref: OverlayReference): Promise<WorkflowOverlayVersionRecord | undefined>;
  getRuleVersion(
    ruleId: string,
    selector: RuleVersionSelector
  ): Promise<RuleVersionRecord | undefined>;
  getTemplateVersion(
    templateId: string,
    selector: TemplateVersionSelector
  ): Promise<TemplateVersionRecord | undefined>;
};

export type MaterializeContext = {
  data: MaterializeDataSource;
};

export type MaterializedRun = {
  workflow: WorkflowDSL;
  steps: StepDef[];
  warnings: string[];
  lockfile: WorkflowLockfile;
  definitionVersion: WorkflowDefinitionVersionRecord;
  overlayVersions: WorkflowOverlayVersionRecord[];
  ruleVersions: Record<string, RuleVersionRecord>;
  templateVersions: Record<string, TemplateVersionRecord>;
};

export type SourceRecord = Record<string, unknown>;

export type VerificationSourceEvidence = {
  sourceKey: string;
  snapshotId: string;
  expectedFingerprint: string;
  observedFingerprint: string;
  matches: boolean;
  fetchedAt: string;
  recordCount: number;
  sample: SourceRecord[];
};

export type RuleVerificationEvidence = {
  ruleId: string;
  version: string;
  checksum: string;
  verifiedAt: string;
  status: "verified" | "stale";
  sources: VerificationSourceEvidence[];
};

export type VerificationResult = {
  verifiedAt: string;
  rules: Record<string, RuleVerificationEvidence>;
};
