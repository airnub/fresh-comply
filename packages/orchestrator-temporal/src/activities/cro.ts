import { persistStepProgress, type StepActivityContext } from "./util.js";
import { withTelemetrySpan } from "@airnub/utils/telemetry";

export type CroNameCheckInput = StepActivityContext & {
  proposedName: string;
};

export type CroNameCheckResult = {
  available: boolean;
  suggestions: string[];
};

export async function lookupCroName(
  input: CroNameCheckInput
): Promise<CroNameCheckResult> {
  return withTelemetrySpan("temporal.activity.lookupCroName", {
    runId: input.runId,
    stepId: input.stepKey,
    orgId: input.orgId,
    tenantId: input.tenantId,
    partnerOrgId: input.partnerOrgId,
    attributes: {
      "freshcomply.temporal.activity": "lookupCroName"
    }
  }, async () => {
    const normalized = input.proposedName.trim();
    const available = normalized.toLowerCase() !== "example clg";
    const suggestions = available
      ? []
      : [
          `${normalized} Services CLG`,
          `${normalized} Foundation CLG`,
          `${normalized} Trust CLG`
        ];
    await persistStepProgress({
      ...input,
      status: available ? "done" : "waiting",
      output: {
        available,
        suggestions
      }
    });
    return {
      available,
      suggestions
    };
  });
}

export type CroPackInput = StepActivityContext & {
  templateId: string;
  payload: Record<string, unknown>;
};

export type CroPackResult = {
  archivePath: string;
  checksum: string;
};

export async function uploadPackToStorage(
  input: CroPackInput
): Promise<CroPackResult> {
  return withTelemetrySpan("temporal.activity.uploadPackToStorage", {
    runId: input.runId,
    stepId: input.stepKey,
    orgId: input.orgId,
    tenantId: input.tenantId,
    partnerOrgId: input.partnerOrgId,
    attributes: {
      "freshcomply.temporal.activity": "uploadPackToStorage",
      "freshcomply.template_id": input.templateId
    }
  }, async () => {
    const checksum = Buffer.from(`${input.templateId}:${Date.now()}`).toString("hex");
    const archivePath = `supabase://documents/${input.runId}/${input.stepKey}/${checksum}.zip`;
    await persistStepProgress({
      ...input,
      status: "done",
      output: { archivePath, checksum }
    });
    return { archivePath, checksum };
  });
}
