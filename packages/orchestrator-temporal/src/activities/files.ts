import { renderBoardMinutes } from "@airnub/doc-templates/index";
import { persistStepProgress, type StepActivityContext } from "./util.js";
import { withTelemetrySpan } from "@airnub/utils/telemetry";

export type PackBuildInput = StepActivityContext & {
  orgName: string;
  meetingDate: string;
  meetingTime: string;
  meetingLocation: string;
};

export type PackBuildResult = {
  markdownPath: string;
  pdfPath: string;
  checksum: string;
};

export async function buildA1Pack(
  input: PackBuildInput
): Promise<PackBuildResult> {
  return withTelemetrySpan("temporal.activity.buildA1Pack", {
    runId: input.runId,
    stepId: input.stepKey,
    orgId: input.orgId,
    attributes: {
      "freshcomply.temporal.activity": "buildA1Pack"
    }
  }, async () => {
    const minutes = renderBoardMinutes({
      orgName: input.orgName,
      date: input.meetingDate,
      time: input.meetingTime,
      location: input.meetingLocation
    });
    const basePath = `supabase://documents/${input.runId}/${input.stepKey}`;
    const checksum = minutes.checksum;
    const markdownPath = `${basePath}/${minutes.filename}`;
    const pdfPath = `${basePath}/${minutes.filename.replace(/\.md$/, ".pdf")}`;
    await persistStepProgress({
      ...input,
      status: "done",
      output: { markdownPath, pdfPath, checksum }
    });
    return {
      markdownPath,
      pdfPath,
      checksum
    };
  });
}
