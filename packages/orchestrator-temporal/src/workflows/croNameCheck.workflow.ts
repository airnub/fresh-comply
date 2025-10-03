import { proxyActivities, setHandler } from "@temporalio/workflow";
import type * as croActivities from "../activities/cro.js";
import type { CroNameCheckResult } from "../activities/cro.js";
import { getResultQuery, getStatusQuery, type StepWorkflowInput, type StepWorkflowStatus } from "./shared.js";

const cro = proxyActivities<typeof croActivities>({
  startToCloseTimeout: "2 minutes",
  retry: {
    maximumAttempts: 3
  }
});

export async function croNameCheckWorkflow(
  input: StepWorkflowInput<{ proposedName: string }>
): Promise<CroNameCheckResult> {
  let status: StepWorkflowStatus = "pending";
  let result: CroNameCheckResult | undefined;

  setHandler(getStatusQuery, () => status);
  setHandler(getResultQuery, () => result);

  status = "running";
  result = await cro.lookupCroName({
    tenantId: input.tenantId,
    orgId: input.orgId,
    runId: input.runId,
    stepKey: input.stepKey,
    partnerOrgId: input.partnerOrgId ?? null,
    proposedName: input.payload.proposedName
  });
  status = "completed";
  return result;
}
