import { annotateSpan, withTelemetrySpan } from "@airnub/utils/telemetry";

export type StepActivityContext = {
  tenantId: string;
  orgId: string;
  runId: string;
  stepKey: string;
  partnerOrgId?: string | null;
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
  return withTelemetrySpan("temporal.activity.persistStepProgress", {
    runId: payload.runId,
    stepId: payload.stepKey,
    orgId: payload.orgId,
    tenantId: payload.tenantId,
    partnerOrgId: payload.partnerOrgId,
    attributes: {
      "freshcomply.temporal.activity": "persistStepProgress",
      "freshcomply.step.status": payload.status
    }
  }, async (span) => {
    annotateSpan(span, { attributes: { "freshcomply.step.notes": payload.notes ?? "" } });
    const timestamp = new Date().toISOString();
    const result: PersistStepResult<T> = {
      ...payload,
      updatedAt: timestamp
    };
    span.setAttribute("freshcomply.step.updated_at", timestamp);
    return result;
  });
}

export type AuditLogInput = StepActivityContext & {
  action: string;
  metadata?: Record<string, unknown>;
};

export async function recordAuditEvent(input: AuditLogInput): Promise<{ recordedAt: string }> {
  return withTelemetrySpan("temporal.activity.recordAuditEvent", {
    runId: input.runId,
    stepId: input.stepKey,
    orgId: input.orgId,
    tenantId: input.tenantId,
    partnerOrgId: input.partnerOrgId,
    attributes: {
      "freshcomply.temporal.activity": "recordAuditEvent",
      "freshcomply.audit.action": input.action
    }
  }, async (span) => {
    annotateSpan(span, { attributes: { "freshcomply.audit.metadata": JSON.stringify(input.metadata ?? {}) } });
    const recordedAt = new Date().toISOString();
    span.setAttribute("freshcomply.audit.recorded_at", recordedAt);
    return {
      recordedAt
    };
  });
}
