import { Connection, WorkflowClient } from "@temporalio/client";

export type TemporalConnectionOptions = {
  address?: string;
};

export type TemporalClientOptions = TemporalConnectionOptions & {
  namespace?: string;
};

export function getTemporalAddress(): string {
  return process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
}

export function getTemporalNamespace(): string {
  return process.env.TEMPORAL_NAMESPACE ?? "default";
}

export function getTaskQueue(): string {
  return process.env.TEMPORAL_TASK_QUEUE ?? "fresh-comply";
}

export async function createTemporalConnection(
  options: TemporalConnectionOptions = {}
): Promise<Connection> {
  const address = options.address ?? getTemporalAddress();
  return await Connection.connect({ address });
}

export async function createTemporalClient(
  options: TemporalClientOptions = {}
): Promise<WorkflowClient> {
  const connection = await createTemporalConnection(options);
  const namespace = options.namespace ?? getTemporalNamespace();
  return new WorkflowClient({ connection, namespace });
}
