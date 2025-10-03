import { z } from "zod";

export const Id = z.string().uuid();

export const Org = z.object({ id: Id, name: z.string(), slug: z.string() });
export const User = z.object({ id: Id, email: z.string().email(), name: z.string().optional() });
export const Membership = z.object({ userId: Id, orgId: Id, role: z.enum(["owner", "admin", "member", "viewer"]) });

export const Engagement = z.object({ id: Id, engagerOrgId: Id, clientOrgId: Id, status: z.enum(["active", "ended"]) });

export const WorkflowDef = z.object({ id: Id, key: z.string(), version: z.string(), title: z.string() });
export const WorkflowRun = z.object({
  id: Id,
  workflowDefId: Id,
  subjectOrgId: Id,
  engagerOrgId: Id.optional(),
  status: z.enum(["draft", "active", "done", "archived"]),
  orchestrationProvider: z.string().optional(),
  orchestrationWorkflowId: z.string().optional(),
  mergedWorkflowSnapshot: z.record(z.any()).optional()
});

export const Step = z.object({
  id: Id,
  runId: Id,
  key: z.string(),
  title: z.string(),
  status: z.enum(["todo", "in_progress", "waiting", "blocked", "done"]),
  orchestrationRunId: z.string().optional(),
  executionMode: z
    .enum(["manual", "temporal", "external:webhook", "external:websocket"])
    .optional(),
  dueDate: z.string().datetime().optional(),
  assigneeUserId: Id.optional(),
  stepTypeVersionId: Id.optional(),
  permissions: z.array(z.string()).optional()
});

export type TOrg = z.infer<typeof Org>;

export type { Database, Tables, TablesInsert, TablesUpdate, Json } from "./supabase";
