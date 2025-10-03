import type {
  StepExecution,
  TemporalStepExecution,
  WebhookStepExecution,
  WebsocketStepExecution
} from "@airnub/engine/types";

type ExecutionAliasKey = "urlAlias" | "tokenAlias" | "signing.secretAlias";

function isTemporalExecution(execution: StepExecution): execution is TemporalStepExecution {
  return execution.mode === "temporal";
}

function isWebhookExecution(execution: StepExecution): execution is WebhookStepExecution {
  return execution.mode === "external:webhook";
}

function isWebsocketExecution(execution: StepExecution): execution is WebsocketStepExecution {
  return execution.mode === "external:websocket";
}

function normaliseExecution(execution: StepExecution): StepExecution {
  switch (execution.mode) {
    case "temporal": {
      const workflow = execution.workflow ?? execution.config?.workflow ?? "";
      const taskQueue = execution.taskQueue ?? execution.config?.taskQueue ?? "";
      const defaultTaskQueue = execution.defaultTaskQueue ?? execution.config?.defaultTaskQueue ?? "";
      return {
        mode: "temporal",
        workflow,
        taskQueue,
        defaultTaskQueue,
        config: {
          workflow,
          taskQueue,
          defaultTaskQueue
        }
      } satisfies TemporalStepExecution;
    }
    case "external:webhook": {
      return {
        mode: "external:webhook",
        config: {
          method: execution.config?.method ?? "POST",
          urlAlias: execution.config?.urlAlias ?? "",
          tokenAlias: execution.config?.tokenAlias ?? "",
          path: execution.config?.path ?? "",
          headers: execution.config?.headers ? { ...execution.config.headers } : undefined,
          signing: execution.config?.signing
            ? { ...execution.config.signing }
            : undefined
        }
      } satisfies WebhookStepExecution;
    }
    case "external:websocket": {
      return {
        mode: "external:websocket",
        config: {
          urlAlias: execution.config?.urlAlias ?? "",
          tokenAlias: execution.config?.tokenAlias ?? "",
          messageSchema: execution.config?.messageSchema ?? "",
          temporalWorkflow: execution.config?.temporalWorkflow ?? "",
          defaultTaskQueue: execution.config?.defaultTaskQueue ?? "",
          taskQueueOverride: execution.config?.taskQueueOverride ?? ""
        }
      } satisfies WebsocketStepExecution;
    }
    default:
      return { mode: "manual" };
  }
}

function sanitizeTemporalExecution(execution: TemporalStepExecution): TemporalStepExecution {
  const workflow = execution.workflow?.trim() ?? "";
  const taskQueue = execution.taskQueue?.trim() ?? "";
  const defaultTaskQueue = execution.defaultTaskQueue?.trim() ?? "";
  const configEntries = [
    ["workflow", workflow],
    ["taskQueue", taskQueue],
    ["defaultTaskQueue", defaultTaskQueue]
  ] as const;
  const config = Object.fromEntries(
    configEntries.filter(([, value]) => value.length > 0)
  ) as TemporalStepExecution["config"];

  const sanitized: TemporalStepExecution = { mode: "temporal" };
  if (workflow) sanitized.workflow = workflow;
  if (taskQueue) sanitized.taskQueue = taskQueue;
  if (defaultTaskQueue) sanitized.defaultTaskQueue = defaultTaskQueue;
  if (config && Object.keys(config).length > 0) sanitized.config = config;
  return sanitized;
}

function sanitizeWebhookExecution(execution: WebhookStepExecution): WebhookStepExecution {
  const urlAlias = execution.config.urlAlias.trim();
  const tokenAlias = execution.config.tokenAlias?.trim();
  const path = execution.config.path?.trim();
  const signingAlias = execution.config.signing?.secretAlias?.trim();
  const signing =
    signingAlias && signingAlias.length > 0
      ? { algo: "hmac-sha256" as const, secretAlias: signingAlias }
      : undefined;

  const config: WebhookStepExecution["config"] = {
    method: execution.config.method,
    urlAlias,
    ...(tokenAlias ? { tokenAlias } : {}),
    ...(path ? { path } : {}),
    ...(execution.config.headers ? { headers: execution.config.headers } : {}),
    ...(signing ? { signing } : {})
  };

  return { mode: "external:webhook", config };
}

function sanitizeWebsocketExecution(execution: WebsocketStepExecution): WebsocketStepExecution {
  const urlAlias = execution.config.urlAlias.trim();
  const tokenAlias = execution.config.tokenAlias?.trim();
  const messageSchema = execution.config.messageSchema?.trim();
  const temporalWorkflow = execution.config.temporalWorkflow?.trim();
  const defaultTaskQueue = execution.config.defaultTaskQueue?.trim();
  const taskQueueOverride = execution.config.taskQueueOverride?.trim();

  const config: WebsocketStepExecution["config"] = {
    urlAlias,
    ...(tokenAlias ? { tokenAlias } : {}),
    ...(messageSchema ? { messageSchema } : {}),
    ...(temporalWorkflow ? { temporalWorkflow } : {}),
    ...(defaultTaskQueue ? { defaultTaskQueue } : {}),
    ...(taskQueueOverride ? { taskQueueOverride } : {})
  };

  return { mode: "external:websocket", config };
}

export {
  ExecutionAliasKey,
  isTemporalExecution,
  isWebhookExecution,
  isWebsocketExecution,
  normaliseExecution,
  sanitizeTemporalExecution,
  sanitizeWebhookExecution,
  sanitizeWebsocketExecution
};
