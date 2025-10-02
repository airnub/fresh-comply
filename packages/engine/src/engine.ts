import { WorkflowDSL, StepDef } from "./types.js";

export function materializeSteps(dsl: WorkflowDSL): StepDef[] {
  // MVP: return steps as-is; branching handled later
  return dsl.steps;
}
