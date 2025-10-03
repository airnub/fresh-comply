import { proxyActivities, setHandler } from "@temporalio/workflow";
import type * as fileActivities from "../activities/files.js";
import type { PackBuildResult } from "../activities/files.js";
import { getResultQuery, getStatusQuery, type StepWorkflowInput, type StepWorkflowStatus } from "./shared.js";

const files = proxyActivities<typeof fileActivities>({
  startToCloseTimeout: "5 minutes",
  retry: {
    maximumAttempts: 3
  }
});

export async function a1PackBuildWorkflow(
  input: StepWorkflowInput<{
    orgName: string;
    meetingDate: string;
    meetingTime: string;
    meetingLocation: string;
  }>
): Promise<PackBuildResult> {
  let status: StepWorkflowStatus = "pending";
  let result: PackBuildResult | undefined;

  setHandler(getStatusQuery, () => status);
  setHandler(getResultQuery, () => result);

  status = "running";
  result = await files.buildA1Pack({
    orgId: input.orgId,
    runId: input.runId,
    stepKey: input.stepKey,
    orgName: input.payload.orgName,
    meetingDate: input.payload.meetingDate,
    meetingTime: input.payload.meetingTime,
    meetingLocation: input.payload.meetingLocation
  });
  status = "completed";
  return result;
}
