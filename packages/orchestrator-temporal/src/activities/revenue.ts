import { persistStepProgress, type StepActivityContext } from "./util.js";

export type Tr2SubmissionInput = StepActivityContext & {
  payload: Record<string, unknown>;
};

export type Tr2SubmissionResult = {
  ticketId: string;
  status: "submitted" | "pending" | "error";
};

export async function submitTr2ViaBridge(
  input: Tr2SubmissionInput
): Promise<Tr2SubmissionResult> {
  const ticketId = `${input.runId}-${input.stepKey}-${Date.now()}`;
  const status: Tr2SubmissionResult["status"] = "submitted";
  await persistStepProgress({
    ...input,
    status: "waiting",
    output: { ticketId, status }
  });
  return { ticketId, status };
}

export type Tr2StatusPollInput = StepActivityContext & {
  ticketId: string;
};

export type Tr2StatusPollResult = {
  ticketId: string;
  status: "accepted" | "pending" | "rejected";
};

export async function pollTr2Status(
  input: Tr2StatusPollInput
): Promise<Tr2StatusPollResult> {
  const status: Tr2StatusPollResult["status"] = "accepted";
  await persistStepProgress({
    ...input,
    status: status === "accepted" ? "done" : "waiting",
    output: { ticketId: input.ticketId, status }
  });
  return { ticketId: input.ticketId, status };
}

export type EtaxClearanceInput = StepActivityContext & {
  taxReference: string;
};

export type EtaxClearanceResult = {
  taxReference: string;
  clearanceStatus: "valid" | "expired" | "pending";
  validUntil: string;
};

export async function checkEtaxClearance(
  input: EtaxClearanceInput
): Promise<EtaxClearanceResult> {
  const result: EtaxClearanceResult = {
    taxReference: input.taxReference,
    clearanceStatus: "valid",
    validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString()
  };
  await persistStepProgress({
    ...input,
    status: "done",
    output: result
  });
  return result;
}
