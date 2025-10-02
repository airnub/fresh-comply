export type NodeKind = "question" | "info" | "action" | "upload" | "doc.generate" | "tool.call" | "verify" | "schedule" | "review";
export type RuleRef = { id: string };
export type StepDef = { id: string; kind: NodeKind; title: string; requires?: string[]; verify?: RuleRef[] };
export type WorkflowDSL = { id: string; version: string; questions?: any[]; branches?: any[]; steps: StepDef[] };
