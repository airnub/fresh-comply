import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@airnub/types";
import { getSupabaseUser } from "../../../../../lib/auth/supabase-ssr";
import { getSupabaseServiceRoleClient } from "../../../../../lib/auth/supabase-service-role";
import { requireRole, type AdminRole } from "../../../../../lib/rbac";

export interface AdminApiContext {
  userId: string;
  email: string;
  role: AdminRole;
}

interface RpcResponse<T> {
  data: T | null;
  error: { message: string; details?: string | null; hint?: string | null } | null;
}

export async function resolveAdminContext(): Promise<AdminApiContext | NextResponse> {
  const user = await getSupabaseUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (user.app_metadata?.admin_role ?? user.user_metadata?.admin_role) as AdminRole | undefined;
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    requireRole({ role }, ["platform_admin", "support_agent"]);
  } catch (error) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { userId: user.id, email: user.email ?? "unknown", role };
}

export function jsonError(status: number, message: string, details?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...details }, { status });
}

export function getAdminServiceRoleClient(): SupabaseClient<Database> {
  return getSupabaseServiceRoleClient();
}

export async function callAdminRpc<T>(procedure: string, params: Record<string, unknown>): Promise<T> {
  const client = getAdminServiceRoleClient();
  const { data, error } = (await client.rpc<T>(procedure, params)) as RpcResponse<T>;

  if (error) {
    const details = error.details ? { details: error.details } : undefined;
    throw Object.assign(new Error(error.message), details ?? {});
  }

  return (data ?? {}) as T;
}
