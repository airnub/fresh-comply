import { performSignedHttpRequest, type HttpRequestConfig } from "./http.js";
import { persistStepProgress, recordAuditEvent, type StepActivityContext } from "./util.js";
import { annotateSpan, withTelemetrySpan } from "@airnub/utils/telemetry";

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
  return withTelemetrySpan("temporal.activity.startExternalJob", {
    runId: input.runId,
    stepId: input.stepKey,
    orgId: input.orgId,
    attributes: {
      "freshcomply.temporal.activity": "startExternalJob"
    }
  }, async (span) => {
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

    annotateSpan(span, { attributes: { "freshcomply.http.status": http.status } });
    return { http };
  });
}

export async function pollExternalJob(input: ExternalJobPollInput): Promise<ExternalJobPollResult> {
  return withTelemetrySpan("temporal.activity.pollExternalJob", {
    runId: input.runId,
    stepId: input.stepKey,
    orgId: input.orgId,
    attributes: {
      "freshcomply.temporal.activity": "pollExternalJob",
      "freshcomply.poll.attempt": input.attempt
    }
  }, async (span) => {
    const response = await performSignedHttpRequest({
      tenantId: input.tenantId,
      context: input,
      request: input.request,
      idempotencyKey: `${input.runId}:${input.stepKey}:poll:${input.attempt}`
    });

    const successTarget = getByPath(response.body, input.success?.path);
    if (matchesCondition(successTarget, input.success)) {
      annotateSpan(span, { attributes: { "freshcomply.poll.outcome": "completed" } });
      return { status: "completed", response };
    }

    const failureTarget = getByPath(response.body, input.failure?.path);
    if (matchesCondition(failureTarget, input.failure)) {
      annotateSpan(span, { attributes: { "freshcomply.poll.outcome": "failed" } });
      return { status: "failed", response };
    }

    annotateSpan(span, { attributes: { "freshcomply.poll.outcome": "running" } });
    return { status: "running", response };
  });
}

export async function persistExternalResult<T>(input: PersistExternalResultInput<T>) {
  return withTelemetrySpan("temporal.activity.persistExternalResult", {
    runId: input.runId,
    stepId: input.stepKey,
    orgId: input.orgId,
    attributes: {
      "freshcomply.temporal.activity": "persistExternalResult",
      "freshcomply.step.status": input.status
    }
  }, async () => persistStepProgress(input));
}

export async function escalateExternalJob(input: EscalationInput) {
  return withTelemetrySpan("temporal.activity.escalateExternalJob", {
    runId: input.runId,
    stepId: input.stepKey,
    orgId: input.orgId,
    attributes: {
      "freshcomply.temporal.activity": "escalateExternalJob",
      "freshcomply.escalation.reason": input.reason
    }
  }, async () => {
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
  });
}
