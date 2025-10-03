import { condition, proxyActivities, setHandler, sleep } from "@temporalio/workflow";
import type * as externalJobActivities from "../activities/externalJob.js";
import {
  getResultQuery,
  getStatusQuery,
  receivedCallbackSignal,
  type ExternalJobCallbackPayload,
  type StepWorkflowInput,
  type StepWorkflowStatus
} from "./shared.js";
import type { HttpRequestConfig, HttpMethod } from "../activities/http.js";

interface ExternalJobIngressConfig {
  timeoutSeconds?: number;
  escalateReason?: string;
}

interface ExternalJobPollingCondition {
  path: string;
  equals?: unknown;
  in?: unknown[];
}

interface ExternalJobPollingConfig {
  enabled?: boolean;
  intervalSeconds?: number;
  maxAttempts?: number;
  statusPath: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  urlAlias?: string;
  tokenAlias?: string;
  signingSecretAlias?: string;
  successWhen?: ExternalJobPollingCondition;
  failureWhen?: ExternalJobPollingCondition;
}

export interface ExternalJobWorkflowPayload {
  tenantId: string;
  egress: HttpRequestConfig;
  payload?: unknown;
  externalRefPath?: string;
  ingress?: ExternalJobIngressConfig;
  polling?: ExternalJobPollingConfig;
  notesOnSuccess?: string;
  notesOnFailure?: string;
  metadata?: Record<string, unknown>;
}

const externalActivities = proxyActivities<typeof externalJobActivities>({
  startToCloseTimeout: "2 minutes",
  retry: {
    maximumAttempts: 3
  }
});

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

function applyTemplate(template: string, context: Record<string, string | undefined>): string {
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_, token: string) => {
    const key = token.trim();
    const value = context[key];
    return value ?? "";
  });
}

function normalizeCallback(
  payload: ExternalJobCallbackPayload | undefined,
  externalRef?: string,
  metadata?: Record<string, unknown>
): ExternalJobCallbackPayload {
  const status = payload?.status ?? "pending";
  return {
    ...payload,
    status,
    externalRef: payload?.externalRef ?? externalRef,
    receivedAt: payload?.receivedAt ?? new Date().toISOString(),
    metadata: {
      ...(payload?.metadata ?? {}),
      ...(metadata ?? {})
    }
  };
}

function isSuccessStatus(status?: string) {
  return status === "success" || status === "completed";
}

export async function externalJobWorkflow(
  input: StepWorkflowInput<ExternalJobWorkflowPayload>
): Promise<unknown> {
  let status: StepWorkflowStatus = "pending";
  let result: unknown;

  setHandler(getStatusQuery, () => status);
  setHandler(getResultQuery, () => result);

  let callbackPayload: ExternalJobCallbackPayload | undefined;
  let externalRef: string | undefined;

  setHandler(receivedCallbackSignal, (payload) => {
    callbackPayload = normalizeCallback(payload, externalRef, { via: "signal" });
  });

  status = "running";

  const requestConfig: HttpRequestConfig = {
    ...input.payload.egress,
    body: input.payload.payload
  };

  const startResult = await externalActivities.startExternalJob({
    tenantId: input.payload.tenantId,
    orgId: input.orgId,
    runId: input.runId,
    stepKey: input.stepKey,
    request: requestConfig
  });

  externalRef = getByPath(startResult.http.body, input.payload.externalRefPath) as string | undefined;

  status = "awaiting_signal";

  const waitForCallback = condition(() => callbackPayload !== undefined);

  const pollingConfig = input.payload.polling;
  const ingressConfig = input.payload.ingress;

  const watchers: Array<Promise<void>> = [];

  if (ingressConfig?.timeoutSeconds && ingressConfig.timeoutSeconds > 0) {
    const timeoutSeconds = ingressConfig.timeoutSeconds;
    const escalateReason = ingressConfig.escalateReason ?? "ingress_timeout";
    watchers.push(
      (async () => {
        await sleep(timeoutSeconds * 1000);
        if (callbackPayload) {
          return;
        }
        await externalActivities.escalateExternalJob({
          orgId: input.orgId,
          runId: input.runId,
          stepKey: input.stepKey,
          reason: escalateReason,
          metadata: {
            timeoutSeconds,
            externalRef,
            runId: input.runId,
            stepKey: input.stepKey
          }
        });
        if (!pollingConfig?.enabled) {
          callbackPayload = normalizeCallback(
            {
              status: "failed",
              error: { message: "Timed out waiting for callback" }
            },
            externalRef,
            { via: "timeout" }
          );
        }
      })()
    );
  }

  if (pollingConfig?.enabled && pollingConfig.statusPath) {
    const interval = Math.max(5, pollingConfig.intervalSeconds ?? 30);
    const maxAttempts = Math.max(1, pollingConfig.maxAttempts ?? 20);
    const pollRequest: HttpRequestConfig = {
      method: pollingConfig.method ?? "GET",
      urlAlias: pollingConfig.urlAlias ?? input.payload.egress.urlAlias,
      tokenAlias: pollingConfig.tokenAlias ?? input.payload.egress.tokenAlias,
      signingSecretAlias:
        pollingConfig.signingSecretAlias ?? input.payload.egress.signingSecretAlias,
      headers: pollingConfig.headers,
      path: applyTemplate(pollingConfig.statusPath, {
        ticketId: externalRef,
        externalRef
      })
    };

    watchers.push(
      (async () => {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          await sleep(interval * 1000);
          if (callbackPayload) {
            return;
          }
          try {
            const pollResult = await externalActivities.pollExternalJob({
              tenantId: input.payload.tenantId,
              orgId: input.orgId,
              runId: input.runId,
              stepKey: input.stepKey,
              request: pollRequest,
              success: pollingConfig.successWhen,
              failure: pollingConfig.failureWhen,
              attempt
            });

            if (pollResult.status === "completed") {
              callbackPayload = normalizeCallback(
                {
                  status: "success",
                  output: pollResult.response.body
                },
                externalRef,
                { via: "polling", attempt }
              );
              return;
            }

            if (pollResult.status === "failed") {
              callbackPayload = normalizeCallback(
                {
                  status: "failed",
                  output: pollResult.response.body,
                  error: { message: "Polling reported failure" }
                },
                externalRef,
                { via: "polling", attempt }
              );
              return;
            }
          } catch (error) {
            await externalActivities.escalateExternalJob({
              orgId: input.orgId,
              runId: input.runId,
              stepKey: input.stepKey,
              reason: "polling_error",
              metadata: {
                attempt,
                error: (error as Error).message,
                externalRef
              }
            });
          }
        }

        if (!callbackPayload) {
          await externalActivities.escalateExternalJob({
            orgId: input.orgId,
            runId: input.runId,
            stepKey: input.stepKey,
            reason: "polling_exhausted",
            metadata: {
              attempts: maxAttempts,
              intervalSeconds: interval,
              externalRef
            }
          });
          callbackPayload = normalizeCallback(
            {
              status: "failed",
              error: { message: "Polling attempts exhausted" }
            },
            externalRef,
            { via: "polling", exhausted: true }
          );
        }
      })()
    );
  }

  await waitForCallback;
  await Promise.allSettled(watchers);

  const persisted = await externalActivities.persistExternalResult({
    orgId: input.orgId,
    runId: input.runId,
    stepKey: input.stepKey,
    status: isSuccessStatus(callbackPayload?.status) ? "done" : "blocked",
    output: {
      start: startResult.http,
      callback: callbackPayload
    },
    notes: isSuccessStatus(callbackPayload?.status)
      ? input.payload.notesOnSuccess ?? "External job completed"
      : input.payload.notesOnFailure ?? "External job failed or timed out"
  });

  status = isSuccessStatus(callbackPayload?.status) ? "completed" : "failed";
  result = {
    start: startResult,
    final: callbackPayload,
    persisted
  };

  return result;
}
