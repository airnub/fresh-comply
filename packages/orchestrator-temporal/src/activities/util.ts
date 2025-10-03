import { annotateSuccess, buildRunAttributes, withSpan } from "@airnub/utils";

export type StepActivityContext = {
  orgId: string;
  runId: string;
  stepKey: string;
};

export type PersistStepPayload<T = unknown> = StepActivityContext & {
  status: "in_progress" | "waiting" | "done" | "blocked" | "todo";
  output?: T;
  notes?: string;
};

export type PersistStepResult<T = unknown> = PersistStepPayload<T> & {
  updatedAt: string;
};

export function createBusinessKey(context: StepActivityContext): string {
  return `${context.orgId}:${context.runId}:${context.stepKey}`;
}

export async function persistStepProgress<T = unknown>(
  payload: PersistStepPayload<T>
): Promise<PersistStepResult<T>> {
  return withSpan(
    "temporal.activity.persistStepProgress",
    { attributes: { ...buildRunAttributes(payload), "freshcomply.step.status": payload.status } },
    async (span) => {
      const timestamp = new Date().toISOString();
      annotateSuccess(span);
      return {
        ...payload,
        updatedAt: timestamp
      };
    }
  );
}

export type AuditLogInput = StepActivityContext & {
  action: string;
  metadata?: Record<string, unknown>;
};

export async function recordAuditEvent(input: AuditLogInput): Promise<{ recordedAt: string }> {
  return withSpan(
    "temporal.activity.recordAuditEvent",
    { attributes: { ...buildRunAttributes(input), "freshcomply.audit.action": input.action } },
    async (span) => {
      annotateSuccess(span);
      return {
        recordedAt: new Date().toISOString()
      };
    }
  );
}
