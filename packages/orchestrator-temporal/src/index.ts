import { createTemporalClient, getTaskQueueForTenant } from "./client.js";
import { buildSearchAttributes } from "./search-attributes.js";
import type { StepWorkflowInput } from "./workflows/shared.js";
import * as workflows from "./workflows/index.js";
import { annotateSpan, withTelemetrySpan } from "@airnub/utils/telemetry";

const WORKFLOW_REGISTRY = {
  croNameCheckWorkflow: workflows.croNameCheckWorkflow,
  a1PackBuildWorkflow: workflows.a1PackBuildWorkflow,
  tr2SubmissionWorkflow: workflows.tr2SubmissionWorkflow,
  etaxClearanceWorkflow: workflows.etaxClearanceWorkflow,
  externalJobWorkflow: workflows.externalJobWorkflow
} as const;

export type SupportedWorkflow = keyof typeof WORKFLOW_REGISTRY;

export const SUPPORTED_WORKFLOWS = Object.keys(WORKFLOW_REGISTRY) as SupportedWorkflow[];

export type StartWorkflowOptions<TPayload = unknown> = {
  workflow: SupportedWorkflow;
  tenantId: string;
  orgId: string;
  runId: string;
  stepKey: string;
  payload: TPayload;
  searchAttributes?: Partial<{
    subjectOrg: string;
    environment: string;
  }>;
};

export type StartWorkflowResult = {
  workflowId: string;
  runId: string;
};

export async function startStepWorkflow<TPayload>(
  options: StartWorkflowOptions<TPayload>
): Promise<StartWorkflowResult> {
  const taskQueue = getTaskQueueForTenant(options.tenantId);
  return withTelemetrySpan("temporal.workflow.start", {
    runId: options.runId,
    stepId: options.stepKey,
    workflow: options.workflow,
    orgId: options.orgId,
    attributes: {
      "freshcomply.temporal.operation": "start",
      "freshcomply.temporal.task_queue": taskQueue,
      "freshcomply.tenant_id": options.tenantId
    }
  }, async (span) => {
    const client = await createTemporalClient();
    try {
      const workflowImpl = WORKFLOW_REGISTRY[
        options.workflow
      ] as (input: StepWorkflowInput<TPayload>) => Promise<unknown>;
      if (!workflowImpl) {
        throw new Error(`Unknown workflow: ${options.workflow}`);
      }
      const workflowId = `${options.orgId}:${options.runId}:${options.stepKey}:${options.workflow}`;
      const args: [StepWorkflowInput<TPayload>] = [
        {
          tenantId: options.tenantId,
          orgId: options.orgId,
          runId: options.runId,
          stepKey: options.stepKey,
          payload: options.payload
        }
      ];
      const searchAttributes = buildSearchAttributes({
        tenantId: options.tenantId,
        runId: options.runId,
        subjectOrg: options.searchAttributes?.subjectOrg ?? options.orgId,
        stepKey: options.stepKey,
        environment: options.searchAttributes?.environment
      });
      const handle = await client.start<typeof workflowImpl>(workflowImpl, {
        args: args as Parameters<typeof workflowImpl>,
        workflowId,
        taskQueue,
        searchAttributes
      });
      annotateSpan(span, {
        attributes: {
          "freshcomply.temporal.workflow_id": handle.workflowId
        }
      });
      span.addEvent("temporal.workflow.started", {
        workflowId: handle.workflowId
      });
      return {
        workflowId: handle.workflowId,
        runId: handle.firstExecutionRunId ?? handle.workflowId
      };
    } finally {
      await client.connection.close();
    }
  });
}

export type SignalWorkflowOptions = {
  tenantId: string;
  workflowId: string;
  signal: string;
  payload?: unknown;
};

export async function signalWorkflow(
  options: SignalWorkflowOptions
): Promise<{ status: unknown; result: unknown }> {
  return withTelemetrySpan("temporal.workflow.signal", {
    attributes: {
      "freshcomply.temporal.operation": "signal",
      "freshcomply.temporal.workflow_id": options.workflowId,
      "freshcomply.signal": options.signal,
      "freshcomply.tenant_id": options.tenantId
    }
  }, async (span) => {
    const client = await createTemporalClient();
    try {
      const handle = client.getHandle(options.workflowId);
      await handle.signal(options.signal as never, options.payload as never);
      const status = await handle.query("getStatus" as never);
      const result = await handle.query("getResult" as never);
      span.addEvent("temporal.workflow.signalled", {
        workflowId: options.workflowId,
        signal: options.signal
      });
      return { status, result };
    } finally {
      await client.connection.close();
    }
  });
}

export type QueryWorkflowOptions = {
  tenantId: string;
  workflowId: string;
};

export async function queryWorkflowStatus(options: QueryWorkflowOptions) {
  return withTelemetrySpan("temporal.workflow.query", {
    attributes: {
      "freshcomply.temporal.operation": "query",
      "freshcomply.temporal.workflow_id": options.workflowId,
      "freshcomply.tenant_id": options.tenantId
    }
  }, async () => {
    const client = await createTemporalClient();
    try {
      const handle = client.getHandle(options.workflowId);
      const status = await handle.query("getStatus" as never);
      const result = await handle.query("getResult" as never);
      return { status, result };
    } finally {
      await client.connection.close();
    }
  });
}

export {
  resolveSecretAlias,
  generateNonce,
  getSecretCacheDebugSnapshot,
  SecretAliasResolutionError
} from "./secrets.js";
