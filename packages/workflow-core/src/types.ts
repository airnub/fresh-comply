export type ExecutionMode =
  | "manual"
  | "temporal"
  | "external:webhook"
  | "external:websocket";

export interface ManualStepExecution {
  mode: "manual";
}

export interface TemporalStepExecution {
  mode: "temporal";
  workflow?: string;
  taskQueue?: string;
  defaultTaskQueue?: string;
  tenantId?: string;
  config?: {
    workflow?: string;
    taskQueue?: string;
    defaultTaskQueue?: string;
    tenantId?: string;
  };
}

export interface WebhookSigningConfig {
  algo: "hmac-sha256";
  secretAlias: string;
}

export interface WebhookExecutionConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  urlAlias: string;
  tokenAlias?: string;
  path?: string;
  headers?: Record<string, string>;
  signing?: WebhookSigningConfig;
}

export interface WebhookStepExecution {
  mode: "external:webhook";
  config: WebhookExecutionConfig;
}

export interface WebsocketExecutionConfig {
  urlAlias: string;
  tokenAlias?: string;
  messageSchema?: string;
  temporalWorkflow?: string;
  defaultTaskQueue?: string;
  taskQueueOverride?: string;
  tenantId?: string;
}

export interface WebsocketStepExecution {
  mode: "external:websocket";
  config: WebsocketExecutionConfig;
}

export type StepExecution =
  | ManualStepExecution
  | TemporalStepExecution
  | WebhookStepExecution
  | WebsocketStepExecution;

export interface VerificationRule {
  rule: string;
  level?: "error" | "warning";
  message_i18n?: Record<string, string>;
}

export interface StepSource {
  id: string;
  url: string;
  verified_at?: string;
}

export interface WorkflowStep {
  id: string;
  kind: string;
  title?: string;
  title_i18n?: Record<string, string>;
  description_i18n?: Record<string, string>;
  stepType?: string;
  execution?: StepExecution;
  required?: boolean;
  requires?: string[];
  verify?: VerificationRule[];
  sources?: StepSource[];
  metadata?: Record<string, unknown>;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface WorkflowDefinition {
  id: string;
  version: string;
  title: string;
  locale?: string;
  jurisdiction?: string;
  industry?: string;
  steps: WorkflowStep[];
  edges?: WorkflowEdge[];
  metadata?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface StepTypePolicy {
  required?: boolean;
  lawful_basis?: "contract" | "legal_obligation" | "legitimate_interest" | "consent";
  retention?: string;
}

export interface ManualStepTypeExecutionDefinition {
  mode: "manual";
}

export interface TemporalStepTypeExecutionDefinition {
  mode: "temporal";
  workflow: string;
  defaultTaskQueue?: string;
}

export interface WebhookStepTypeExecutionDefinition {
  mode: "external:webhook";
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  urlAlias: string;
  tokenAlias?: string;
  headers?: Record<string, string>;
  signing?: WebhookSigningConfig;
}

export interface WebsocketStepTypeExecutionDefinition {
  mode: "external:websocket";
  urlAlias: string;
  tokenAlias?: string;
  messageSchema?: string;
  temporalWorkflow?: string;
  defaultTaskQueue?: string;
}

export type StepTypeExecutionDefinition =
  | ManualStepTypeExecutionDefinition
  | TemporalStepTypeExecutionDefinition
  | WebhookStepTypeExecutionDefinition
  | WebsocketStepTypeExecutionDefinition;

export interface StepTypeDefinition {
  name: string;
  description?: string;
  i18n?: Record<string, Record<string, string>>;
  execution: StepTypeExecutionDefinition;
  inputSchema: string;
  outputSchema?: string;
  permissions?: string[];
  policy?: StepTypePolicy;
}
