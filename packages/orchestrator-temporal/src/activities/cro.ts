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
  const checksum = Buffer.from(`${input.templateId}:${Date.now()}`).toString("hex");
  const archivePath = `supabase://documents/${input.runId}/${input.stepKey}/${checksum}.zip`;
  await persistStepProgress({
    ...input,
    status: "done",
    output: { archivePath, checksum }
  });
  return { archivePath, checksum };
}
