export type NodeKind = "question" | "info" | "action" | "upload" | "doc.generate" | "tool.call" | "verify" | "schedule" | "review";
export type RuleRef = { id: string };
export type StepExecution = {
  mode: "manual" | "temporal";
  workflow?: string;
  taskQueue?: string;
  config?: Record<string, unknown>;
};

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
