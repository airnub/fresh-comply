import { defineQuery, defineSignal } from "@temporalio/workflow";

export type StepWorkflowInput<TInput = unknown> = {
  orgId: string;
  runId: string;
  stepKey: string;
  payload: TInput;
};

export type StepWorkflowStatus =
  | "pending"
  | "running"
  | "awaiting_signal"
  | "completed"
  | "failed";

export const confirmManualFilingSignal = defineSignal<[{ receiptUrl?: string; notes?: string }]>(
  "confirmManualFiling"
);

export type ExternalJobCallbackPayload = {
  status?: "success" | "error" | "pending" | "completed" | "failed";
  output?: unknown;
  error?: { message: string; code?: string; details?: unknown };
  externalRef?: string;
  receivedAt?: string;
  metadata?: Record<string, unknown>;
};

export const receivedCallbackSignal = defineSignal<[ExternalJobCallbackPayload]>("receivedCallback");

export const getStatusQuery = defineQuery<StepWorkflowStatus>("getStatus");

export const getResultQuery = defineQuery<unknown>("getResult");
