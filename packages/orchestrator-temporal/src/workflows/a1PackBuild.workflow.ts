import { proxyActivities, setHandler } from "@temporalio/workflow";
import type { DocumentBrandingMetadata } from "@airnub/doc-templates/index";
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
    branding?: DocumentBrandingMetadata;
  }>
): Promise<PackBuildResult> {
  let status: StepWorkflowStatus = "pending";
  let result: PackBuildResult | undefined;

  setHandler(getStatusQuery, () => status);
  setHandler(getResultQuery, () => result);

  status = "running";
  result = await files.buildA1Pack({
    tenantId: input.tenantId,
    orgId: input.orgId,
    runId: input.runId,
    stepKey: input.stepKey,
    partnerOrgId: input.partnerOrgId ?? null,
    orgName: input.payload.orgName,
    meetingDate: input.payload.meetingDate,
    meetingTime: input.payload.meetingTime,
    meetingLocation: input.payload.meetingLocation,
    branding: input.payload.branding
  });
  status = "completed";
  return result;
}
