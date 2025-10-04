import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@airnub/types";
import { getSupabaseUser } from "../../../lib/auth/supabase-ssr";
import { getSupabaseServiceRoleClient } from "../../../lib/auth/supabase-service-role";
import { requireRole, type AdminRole } from "../../../lib/rbac";

export interface AdminApiContext {
  userId: string;
  email: string;
  role: AdminRole;
  tenantOrgId: string | null;
  actorOrgId: string | null;
  onBehalfOfOrgId: string | null;
}

function readOrgId(user: User, key: string): string | null {
  const value = (user.app_metadata?.[key] ?? user.user_metadata?.[key]) as unknown;
  return typeof value === "string" && value.length > 0 ? value : null;
}

interface RpcResponse<T> {
  data: T | null;
  error: { message: string; details?: string | null; hint?: string | null } | null;
}

export type JsonRecord = Record<string, unknown>;

export function jsonError(status: number, message: string, details?: JsonRecord) {
  return NextResponse.json({ error: message, ...details }, { status });
}

export async function resolveAdminContext(allowedRoles?: AdminRole[]): Promise<AdminApiContext | NextResponse> {
  const user = await getSupabaseUser();
  if (!user) {
    return jsonError(401, "Unauthorized");
  }

  const role = (user.app_metadata?.admin_role ?? user.user_metadata?.admin_role) as AdminRole | undefined;
  if (!role) {
    return jsonError(403, "Forbidden");
  }

  try {
    requireRole({ role }, allowedRoles ?? ["platform_admin", "support_agent", "compliance_moderator", "dpo"]);
  } catch (error) {
    return jsonError(403, "Forbidden");
  }

  const tenantOrgId = readOrgId(user, "org_id");
  const actorOrgId = readOrgId(user, "actor_org_id") ?? tenantOrgId;
  const onBehalfOfOrgId = readOrgId(user, "on_behalf_of_org_id");

  if (!tenantOrgId && !actorOrgId) {
    return jsonError(403, "Tenant context unavailable");
  }

  return {
    userId: user.id,
    email: user.email ?? "unknown",
    role,
    tenantOrgId,
    actorOrgId,
    onBehalfOfOrgId,
  };
}

export function getAdminServiceRoleClient(): SupabaseClient<Database> {
  return getSupabaseServiceRoleClient();
}

export async function callAdminRpc<T>(procedure: string, params: JsonRecord): Promise<T> {
  const client = getAdminServiceRoleClient();
  const { data, error } = (await client.rpc<T>(procedure, params)) as RpcResponse<T>;

  if (error) {
    const err = new Error(error.message);
    if (error.details) {
      (err as Error & { details?: string }).details = error.details;
    }
    throw err;
  }

  return (data ?? {}) as T;
}

export async function parseJsonBody<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T> | NextResponse> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return jsonError(400, "Invalid JSON body");
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    return jsonError(422, "Validation failed", {
      validationErrors: result.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`),
    });
  }

  return result.data;
}
