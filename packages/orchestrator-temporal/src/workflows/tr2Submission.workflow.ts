import { condition, proxyActivities, setHandler } from "@temporalio/workflow";
import type * as revenueActivities from "../activities/revenue.js";
import type { Tr2SubmissionResult, Tr2StatusPollResult } from "../activities/revenue.js";
import {
  confirmManualFilingSignal,
  getResultQuery,
  getStatusQuery,
  type StepWorkflowInput,
  type StepWorkflowStatus
} from "./shared.js";

const revenue = proxyActivities<typeof revenueActivities>({
  startToCloseTimeout: "5 minutes",
  retry: {
    maximumAttempts: 3
  }
});

export type Tr2WorkflowInput = StepWorkflowInput<{ payload: Record<string, unknown> }>;

export type Tr2WorkflowResult = {
  ticketId: string;
  status: string;
  receiptUrl?: string;
  notes?: string;
};

export async function tr2SubmissionWorkflow(input: Tr2WorkflowInput): Promise<Tr2WorkflowResult> {
  let status: StepWorkflowStatus = "pending";
  let result: Tr2WorkflowResult | undefined;
  let submission: Tr2SubmissionResult | undefined;
  let poll: Tr2StatusPollResult | undefined;
  let manualReceipt: { receiptUrl?: string; notes?: string } | undefined;

  setHandler(getStatusQuery, () => status);
  setHandler(getResultQuery, () => result ?? poll ?? manualReceipt ?? null);

  setHandler(confirmManualFilingSignal, (payload) => {
    manualReceipt = payload;
    status = "completed";
  });

  status = "running";
  submission = await revenue.submitTr2ViaBridge({
    orgId: input.orgId,
    runId: input.runId,
    stepKey: input.stepKey,
    payload: input.payload.payload
  });

  poll = await revenue.pollTr2Status({
    orgId: input.orgId,
    runId: input.runId,
    stepKey: input.stepKey,
    ticketId: submission.ticketId
  });

  if (poll.status === "accepted") {
    status = "completed";
    result = {
      ticketId: submission.ticketId,
      status: poll.status
    };
    return result;
  }

  status = "awaiting_signal";
  await condition(() => status === "completed");

  result = {
    ticketId: submission.ticketId,
    status: poll.status,
    receiptUrl: manualReceipt?.receiptUrl,
    notes: manualReceipt?.notes
  };

  return result;
}
