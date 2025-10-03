import { proxyActivities, setHandler } from "@temporalio/workflow";
import type * as revenueActivities from "../activities/revenue.js";
import type { EtaxClearanceResult } from "../activities/revenue.js";
import { getResultQuery, getStatusQuery, type StepWorkflowInput, type StepWorkflowStatus } from "./shared.js";

const revenue = proxyActivities<typeof revenueActivities>({
  startToCloseTimeout: "2 minutes",
  retry: {
    maximumAttempts: 3
  }
});

export async function etaxClearanceWorkflow(
  input: StepWorkflowInput<{ taxReference: string }>
): Promise<EtaxClearanceResult> {
  let status: StepWorkflowStatus = "pending";
  let result: EtaxClearanceResult | undefined;

  setHandler(getStatusQuery, () => status);
  setHandler(getResultQuery, () => result);

  status = "running";
  result = await revenue.checkEtaxClearance({
    orgId: input.orgId,
    runId: input.runId,
    stepKey: input.stepKey,
    taxReference: input.payload.taxReference
  });
  status = "completed";
  return result;
}
