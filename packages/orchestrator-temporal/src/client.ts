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

function sanitizeQueueSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

export function getTaskQueueForTenant(tenantId: string): string {
  if (!tenantId || typeof tenantId !== "string") {
    throw new Error("tenantId is required to resolve task queue");
  }
  const segment = sanitizeQueueSegment(tenantId);
  return segment.length > 0 ? `tenant-${segment}-main` : "tenant-unknown-main";
}

export function getTenantQueueAllowList(): string[] {
  const raw = process.env.TEMPORAL_TENANT_QUEUE_ALLOW_LIST ?? "";
  const tenants = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return Array.from(new Set(tenants));
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
