export type NodeKind = "question" | "info" | "action" | "upload" | "doc.generate" | "tool.call" | "verify" | "schedule" | "review";
export type RuleRef = { id: string };
export type ManualStepExecution = {
  mode: "manual";
};

export type TemporalExecutionConfig = {
  workflow?: string;
  taskQueue?: string;
  defaultTaskQueue?: string;
};

export type TemporalStepExecution = {
  mode: "temporal";
  workflow?: string;
  taskQueue?: string;
  defaultTaskQueue?: string;
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
