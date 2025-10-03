import { performSignedHttpRequest, type HttpRequestConfig } from "./http.js";
import { persistStepProgress, recordAuditEvent, type StepActivityContext } from "./util.js";

export interface ExternalJobStartInput extends StepActivityContext {
  tenantId: string;
  request: HttpRequestConfig;
}

export interface ExternalJobStartResult {
  http: Awaited<ReturnType<typeof performSignedHttpRequest>>;
}

export interface ExternalJobPollInput extends StepActivityContext {
  tenantId: string;
  request: HttpRequestConfig;
  success?: { path: string; equals?: unknown; in?: unknown[] };
  failure?: { path: string; equals?: unknown; in?: unknown[] };
  attempt: number;
}

export type ExternalJobPollStatus = "running" | "completed" | "failed";

export interface ExternalJobPollResult {
  status: ExternalJobPollStatus;
  response: Awaited<ReturnType<typeof performSignedHttpRequest>>;
}

export interface PersistExternalResultInput<T = unknown> extends StepActivityContext {
  status: "in_progress" | "waiting" | "done" | "blocked" | "todo";
  output?: T;
  notes?: string;
}

export interface EscalationInput extends StepActivityContext {
  reason: string;
  metadata?: Record<string, unknown>;
}

function getByPath(payload: unknown, path?: string): unknown {
  if (!path || !payload || typeof payload !== "object") {
    return undefined;
  }

  const segments = path.split(".").filter(Boolean);
  let current: unknown = payload;
  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function matchesCondition(target: unknown, condition?: { equals?: unknown; in?: unknown[] }): boolean {
  if (!condition) {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(condition, "equals")) {
    return target === condition.equals;
  }
  if (Array.isArray(condition.in)) {
    return condition.in.some((item) => item === target);
  }
  return false;
}

export async function startExternalJob(input: ExternalJobStartInput): Promise<ExternalJobStartResult> {
  const http = await performSignedHttpRequest({
    tenantId: input.tenantId,
    context: input,
    request: input.request
  });

  await persistStepProgress({
    orgId: input.orgId,
    runId: input.runId,
    stepKey: input.stepKey,
    status: "waiting",
    output: { http },
    notes: "External job initiated; awaiting callback"
  });

  return { http };
}

export async function pollExternalJob(input: ExternalJobPollInput): Promise<ExternalJobPollResult> {
  const response = await performSignedHttpRequest({
    tenantId: input.tenantId,
    context: input,
    request: input.request,
    idempotencyKey: `${input.runId}:${input.stepKey}:poll:${input.attempt}`
  });

  const successTarget = getByPath(response.body, input.success?.path);
  if (matchesCondition(successTarget, input.success)) {
    return { status: "completed", response };
  }

  const failureTarget = getByPath(response.body, input.failure?.path);
  if (matchesCondition(failureTarget, input.failure)) {
    return { status: "failed", response };
  }

  return { status: "running", response };
}

export async function persistExternalResult<T>(input: PersistExternalResultInput<T>) {
  return await persistStepProgress(input);
}

export async function escalateExternalJob(input: EscalationInput) {
  await recordAuditEvent({
    orgId: input.orgId,
    runId: input.runId,
    stepKey: input.stepKey,
    action: "external_job_escalation",
    metadata: {
      reason: input.reason,
      ...input.metadata
    }
  });
}
