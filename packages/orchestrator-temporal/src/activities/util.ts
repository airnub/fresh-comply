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
  const timestamp = new Date().toISOString();
  return {
    ...payload,
    updatedAt: timestamp
  };
}

export type AuditLogInput = StepActivityContext & {
  action: string;
  metadata?: Record<string, unknown>;
};

export async function recordAuditEvent(input: AuditLogInput): Promise<{ recordedAt: string }> {
  return {
    recordedAt: new Date().toISOString()
  };
}
