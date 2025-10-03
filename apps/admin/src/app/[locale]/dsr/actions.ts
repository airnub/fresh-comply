"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseClient, getSupabaseUser, SupabaseConfigurationError } from "../../../lib/auth/supabase-ssr";
import {
  getServiceSupabaseClient,
  SupabaseServiceConfigurationError
} from "@airnub/utils/supabase-service";

export type DsrActionResult = { ok: boolean; error?: string };

async function resolveContext() {
  try {
    const client = getSupabaseClient();
    const user = await getSupabaseUser();
    return { client, user };
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      console.warn("Supabase unavailable for DSR admin actions", error.message);
      return null;
    }
    console.error("Unexpected Supabase error during DSR action", error);
    return null;
  }
}

function resolveServiceClient() {
  try {
    return getServiceSupabaseClient();
  } catch (error) {
    if (error instanceof SupabaseServiceConfigurationError) {
      console.warn("Service client unavailable for DSR audit logging", error.message);
      return null;
    }
    throw error;
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function loadRequest(client: ReturnType<typeof getSupabaseClient>, id: string) {
  const { data, error } = await client
    .from("dsr_requests")
    .select("id, tenant_org_id, status, due_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Unable to load DSR request", { id, error });
    return null;
  }
  if (!data) {
    return null;
  }
  return data;
}

export async function reassignDsrRequest(id: string, email: string, reason: string): Promise<DsrActionResult> {
  const context = await resolveContext();
  if (!context) {
    return { ok: false, error: "supabase_unavailable" };
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail.includes("@")) {
    return { ok: false, error: "invalid_email" };
  }

  const { client, user } = context;
  const request = await loadRequest(client, id);
  if (!request) {
    return { ok: false, error: "not_found" };
  }

  const now = new Date().toISOString();
  let assigneeUserId: string | null = null;
  const service = resolveServiceClient();

  if (service) {
    const { data: candidate, error: lookupError } = await service
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (lookupError) {
      console.warn("Unable to lookup assignee user", lookupError);
    }

    if (candidate?.id) {
      const { data: membership } = await service
        .from("memberships")
        .select("user_id")
        .eq("user_id", candidate.id)
        .eq("org_id", request.tenant_org_id)
        .maybeSingle();

      if (!membership) {
        return { ok: false, error: "not_member" };
      }
      assigneeUserId = candidate.id;
    }
  }

  const nextStatus = request.status === "completed" ? request.status : "in_progress";

  const { error: updateError } = await client
    .from("dsr_requests")
    .update({
      assignee_email: normalizedEmail,
      assignee_user_id: assigneeUserId,
      status: nextStatus,
      updated_at: now
    })
    .eq("id", id);

  if (updateError) {
    console.error("Unable to reassign DSR request", updateError);
    return { ok: false, error: updateError.message };
  }

  if (service) {
    await service.from("audit_log").insert({
      actor_user_id: user?.id ?? null,
      actor_org_id: request.tenant_org_id,
      action: "dsr.request.reassigned",
      meta_json: {
        request_id: id,
        assignee_email: normalizedEmail,
        assignee_user_id: assigneeUserId,
        reason
      }
    });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function completeDsrRequest(id: string, reason: string): Promise<DsrActionResult> {
  const context = await resolveContext();
  if (!context) {
    return { ok: false, error: "supabase_unavailable" };
  }
  const { client, user } = context;
  const request = await loadRequest(client, id);
  if (!request) {
    return { ok: false, error: "not_found" };
  }

  const now = new Date().toISOString();
  const { error } = await client
    .from("dsr_requests")
    .update({ status: "completed", resolved_at: now, paused_at: null, updated_at: now })
    .eq("id", id);

  if (error) {
    console.error("Unable to complete DSR request", error);
    return { ok: false, error: error.message };
  }

  const service = resolveServiceClient();
  if (service) {
    await service.from("audit_log").insert({
      actor_user_id: user?.id ?? null,
      actor_org_id: request.tenant_org_id,
      action: "dsr.request.completed",
      meta_json: {
        request_id: id,
        reason,
        resolved_at: now
      }
    });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function togglePauseDsrRequest(id: string, reason: string): Promise<DsrActionResult> {
  const context = await resolveContext();
  if (!context) {
    return { ok: false, error: "supabase_unavailable" };
  }

  const { client, user } = context;
  const request = await loadRequest(client, id);
  if (!request) {
    return { ok: false, error: "not_found" };
  }

  if (request.status === "completed") {
    return { ok: false, error: "already_completed" };
  }

  const now = new Date().toISOString();
  const nextStatus = request.status === "paused" ? "in_progress" : "paused";
  const update: Record<string, unknown> = {
    status: nextStatus,
    updated_at: now
  };
  if (nextStatus === "paused") {
    update.paused_at = now;
  } else {
    update.paused_at = null;
  }

  const { error } = await client.from("dsr_requests").update(update).eq("id", id);
  if (error) {
    console.error("Unable to toggle DSR pause", error);
    return { ok: false, error: error.message };
  }

  const service = resolveServiceClient();
  if (service) {
    await service.from("audit_log").insert({
      actor_user_id: user?.id ?? null,
      actor_org_id: request.tenant_org_id,
      action: nextStatus === "paused" ? "dsr.request.paused" : "dsr.request.resumed",
      meta_json: {
        request_id: id,
        reason,
        paused_at: nextStatus === "paused" ? now : null
      }
    });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
