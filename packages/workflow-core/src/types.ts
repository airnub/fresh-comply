export type ExecutionMode = "manual" | "temporal" | "external";

export interface StepExecution {
  mode: ExecutionMode;
  workflow?: string;
  taskQueue?: string;
  externalWebhook?: string;
  input_schema?: string;
  secrets?: string[];
}

export type LawfulBasis =
  | "contract"
  | "legal_obligation"
  | "legitimate_interest"
  | "consent";

export interface StepPolicyRetention {
  entity: string;
  duration: string;
}

export interface StepPolicy {
  lawful_basis?: LawfulBasis;
  retention?: StepPolicyRetention;
  pii?: string[];
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
  permissions?: string[];
  requires?: string[];
  verify?: VerificationRule[];
  sources?: StepSource[];
  policy?: StepPolicy;
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
