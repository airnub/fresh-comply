export type ExecutionMode = "manual" | "temporal" | "external";

export interface StepExecution {
  mode: ExecutionMode;
  workflow?: string;
  taskQueue?: string;
  webhook?: string;
  input_schema?: string;
  permissions?: string[];
  secret_aliases?: string[];
}

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
