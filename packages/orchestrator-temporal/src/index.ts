import { annotateSuccess, buildRunAttributes, recordSpanError, withSpan } from "@airnub/utils";
import { createTemporalClient, getTaskQueue } from "./client.js";
import { buildSearchAttributes } from "./search-attributes.js";
import type { StepWorkflowInput } from "./workflows/shared.js";
import * as workflows from "./workflows/index.js";

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
  return withSpan(
    "temporal.client.startStepWorkflow",
    {
      attributes: {
        ...buildRunAttributes({ orgId: options.orgId, runId: options.runId, stepKey: options.stepKey }),
        "freshcomply.workflow": options.workflow
      }
    },
    async (span) => {
      const client = await createTemporalClient();
      try {
        const workflowImpl = WORKFLOW_REGISTRY[options.workflow];
        if (!workflowImpl) {
          throw new Error(`Unknown workflow: ${options.workflow}`);
        }
        const workflowId = `${options.orgId}:${options.runId}:${options.stepKey}:${options.workflow}`;
        const args: [StepWorkflowInput<TPayload>] = [
          {
            orgId: options.orgId,
            runId: options.runId,
            stepKey: options.stepKey,
            payload: options.payload
          }
        ];
        const searchAttributes = buildSearchAttributes({
          runId: options.runId,
          subjectOrg: options.searchAttributes?.subjectOrg ?? options.orgId,
          stepKey: options.stepKey,
          environment: options.searchAttributes?.environment
        });
        const handle = await client.start(workflowImpl, {
          args,
          workflowId,
          taskQueue: getTaskQueue(),
          searchAttributes
        });
        span.setAttributes({ "freshcomply.workflowId": handle.workflowId });
        annotateSuccess(span);
        return {
          workflowId: handle.workflowId,
          runId: handle.firstExecutionRunId ?? handle.workflowId
        };
      } catch (error) {
        recordSpanError(span, error);
        throw error;
      } finally {
        await client.connection.close();
      }
    }
  );
}

export type SignalWorkflowOptions = {
  workflowId: string;
  signal: string;
  payload?: unknown;
};

export async function signalWorkflow(
  options: SignalWorkflowOptions
): Promise<{ status: unknown; result: unknown }> {
  return withSpan(
    "temporal.client.signalWorkflow",
    {
      attributes: {
        ...buildRunAttributes({ workflowId: options.workflowId }),
        "freshcomply.signal": options.signal
      }
    },
    async (span) => {
      const client = await createTemporalClient();
      try {
        const handle = client.getHandle(options.workflowId);
        await handle.signal(options.signal as never, options.payload as never);
        const status = await handle.query("getStatus" as never);
        const result = await handle.query("getResult" as never);
        annotateSuccess(span, { "freshcomply.signal.status": `${status}` });
        return { status, result };
      } catch (error) {
        recordSpanError(span, error);
        throw error;
      } finally {
        await client.connection.close();
      }
    }
  );
}

export async function queryWorkflowStatus(workflowId: string) {
  return withSpan(
    "temporal.client.queryWorkflowStatus",
    { attributes: { ...buildRunAttributes({ workflowId }) } },
    async (span) => {
      const client = await createTemporalClient();
      try {
        const handle = client.getHandle(workflowId);
        const status = await handle.query("getStatus" as never);
        const result = await handle.query("getResult" as never);
        annotateSuccess(span, { "freshcomply.status": `${status}` });
        return { status, result };
      } catch (error) {
        recordSpanError(span, error);
        throw error;
      } finally {
        await client.connection.close();
      }
    }
  );
}

export {
  resolveSecretAlias,
  generateNonce,
  getSecretCacheDebugSnapshot,
  SecretAliasResolutionError
} from "./secrets.js";
