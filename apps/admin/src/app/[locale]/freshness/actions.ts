"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseClient, getSupabaseUser, SupabaseConfigurationError } from "../../../lib/auth/supabase-ssr";

type ModerationResult = { ok: boolean; error?: string };

async function resolveContext() {
  try {
    const client = getSupabaseClient();
    const user = await getSupabaseUser();
    return { client, user };
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      console.warn("Supabase unavailable for freshness moderation", error.message);
      return null;
    }
    console.error("Unexpected Supabase moderation error", error);
    return null;
  }
}

export async function approvePendingUpdate(id: string, reason: string): Promise<ModerationResult> {
  const context = await resolveContext();
  const now = new Date().toISOString();
  if (!context) {
    return { ok: true };
  }

  const { client, user } = context;
  const { data, error } = await client
    .from("freshness_pending_updates")
    .update({
      status: "approved",
      approval_reason: reason,
      rejection_reason: null,
      approved_by_user_id: user?.id ?? null,
      verified_at: now,
      updated_at: now
    })
    .eq("id", id)
    .select("workflow_keys, source_key, current_snapshot_id")
    .maybeSingle();

  if (error) {
    console.error("Unable to approve freshness update", error);
    return { ok: false, error: error.message };
  }

  if (data?.workflow_keys?.length) {
    await bumpWorkflowVersions(client, data.workflow_keys);
    if (data.source_key === "funding_radar" && data.current_snapshot_id) {
      await linkFundingOpportunitiesToWorkflows(client, data.current_snapshot_id, data.workflow_keys);
    }
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function rejectPendingUpdate(id: string, reason: string): Promise<ModerationResult> {
  const context = await resolveContext();
  const now = new Date().toISOString();
  if (!context) {
    return { ok: true };
  }

  const { client, user } = context;
  const { error } = await client
    .from("freshness_pending_updates")
    .update({
      status: "rejected",
      rejection_reason: reason,
      approval_reason: null,
      approved_by_user_id: user?.id ?? null,
      updated_at: now
    })
    .eq("id", id);

  if (error) {
    console.error("Unable to reject freshness update", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

async function bumpWorkflowVersions(client: ReturnType<typeof getSupabaseClient>, workflowKeys: string[]) {
  if (!workflowKeys.length) return;
  const { data, error } = await client
    .from("workflow_defs")
    .select("id, version")
    .in("key", workflowKeys);

  if (error) {
    console.warn("Unable to load workflow definitions for bump", error);
    return;
  }

  if (!data?.length) {
    return;
  }

  await Promise.all(
    data.map(async (row) => {
      const nextVersion = bumpPatch(row.version ?? "0.0.0");
      const { error: updateError } = await client
        .from("workflow_defs")
        .update({ version: nextVersion })
        .eq("id", row.id);
      if (updateError) {
        console.warn(`Unable to bump workflow ${row.id}`, updateError);
      }
    })
  );
}

function bumpPatch(version: string) {
  const [major, minor, patch] = version.split(".").map((part) => Number.parseInt(part, 10));
  const nextPatch = Number.isFinite(patch) ? patch + 1 : 1;
  const safeMinor = Number.isFinite(minor) ? minor : 0;
  const safeMajor = Number.isFinite(major) ? major : 0;
  return `${safeMajor}.${safeMinor}.${nextPatch}`;
}

async function linkFundingOpportunitiesToWorkflows(
  client: ReturnType<typeof getSupabaseClient>,
  snapshotId: string,
  workflowKeys: string[]
) {
  if (!workflowKeys.length) return;
  const { data: snapshot, error: snapshotError } = await client
    .from("freshness_snapshots")
    .select("fingerprint")
    .eq("id", snapshotId)
    .maybeSingle();

  if (snapshotError || !snapshot?.fingerprint) {
    console.warn("Unable to resolve funding snapshot for workflow linking", snapshotError);
    return;
  }

  const { data: opportunities, error: fundingError } = await client
    .from("funding_opportunities")
    .select("id")
    .eq("snapshot_fingerprint", snapshot.fingerprint);

  if (fundingError) {
    console.warn("Unable to load funding opportunities for workflow linking", fundingError);
    return;
  }

  if (!opportunities?.length) return;

  const rows = workflowKeys.flatMap((workflowKey) =>
    opportunities.map((opportunity) => ({
      funding_opportunity_id: opportunity.id,
      workflow_key: workflowKey
    }))
  );

  const { error: linkError } = await client
    .from("funding_opportunity_workflows")
    .upsert(rows, { onConflict: "funding_opportunity_id,workflow_key" });

  if (linkError) {
    console.warn("Unable to persist funding opportunity workflow links", linkError);
  }
}
