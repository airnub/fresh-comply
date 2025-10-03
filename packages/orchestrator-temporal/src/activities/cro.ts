import { annotateSuccess, buildRunAttributes, withSpan } from "@airnub/utils";
import { persistStepProgress, type StepActivityContext } from "./util.js";

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
  return withSpan(
    "temporal.activity.cro.lookupName",
    { attributes: { ...buildRunAttributes(input), "freshcomply.cro.proposedName": input.proposedName } },
    async (span) => {
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
      annotateSuccess(span, { "freshcomply.cro.available": available });
      return {
        available,
        suggestions
      };
    }
  );
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
  return withSpan(
    "temporal.activity.cro.uploadPack",
    { attributes: { ...buildRunAttributes(input), "freshcomply.cro.templateId": input.templateId } },
    async (span) => {
      const checksum = Buffer.from(`${input.templateId}:${Date.now()}`).toString("hex");
      const archivePath = `supabase://documents/${input.runId}/${input.stepKey}/${checksum}.zip`;
      await persistStepProgress({
        ...input,
        status: "done",
        output: { archivePath, checksum }
      });
      annotateSuccess(span, { "freshcomply.cro.checksum": checksum });
      return { archivePath, checksum };
    }
  );
}
