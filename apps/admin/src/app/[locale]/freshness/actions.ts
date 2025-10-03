"use server";

import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient, getSupabaseUser, SupabaseConfigurationError } from "../../../lib/auth/supabase-ssr";
import { annotateSpan, withTelemetrySpan } from "@airnub/utils/telemetry";
import type { Json } from "@airnub/types/supabase";
import type { SourceDiff } from "@airnub/freshness/watcher";

type ModerationResult = { ok: boolean; error?: string };

type SourceModerationProposal = {
  kind: "source_change";
  sourceKey: string;
  severity: string;
  summary: string;
  detectedAt: string;
  workflows: string[];
  diff: SourceDiff;
  current: {
    snapshotId: string | null | undefined;
    fingerprint: string;
    records?: unknown;
  };
  previous: null | {
    snapshotId: string | undefined;
    fingerprint: string;
    records?: unknown;
  };
};

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

function readOrgId(user: User | null | undefined, key: string): string | null {
  const value = user?.app_metadata?.[key] ?? user?.user_metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function approvePendingUpdate(id: string, reason: string): Promise<ModerationResult> {
  return withTelemetrySpan("action.freshness.approve", {
    attributes: {
      "freshcomply.action": "freshness.update.approve"
    }
  }, async (span) => {
    annotateSpan(span, { attributes: { "freshcomply.freshness.update_id": id } });

    const context = await resolveContext();
    const now = new Date().toISOString();
    if (!context) {
      span.setAttribute("freshcomply.action.outcome", "supabase_unavailable");
      return { ok: true };
    }

    const tenantOrgId = readOrgId(context.user, "tenant_org_id");
    const partnerOrgId = readOrgId(context.user, "partner_org_id");
    annotateSpan(span, { tenantId: tenantOrgId, partnerOrgId });

    const { client, user } = context;
    const { data, error } = await client
      .from("moderation_queue")
      .update({
        status: "approved",
        notes_md: reason,
        reviewer_id: user?.id ?? null,
        decided_at: now,
        updated_at: now
      })
      .eq("id", id)
      .select("proposal")
      .maybeSingle();

    if (error) {
      console.error("Unable to approve freshness update", error);
      span.setAttribute("freshcomply.action.outcome", "update_failed");
      return { ok: false, error: error.message };
    }

    const proposal = parseModerationProposal(data?.proposal);

    if (proposal?.workflows?.length) {
      await bumpWorkflowVersions(client, proposal.workflows);
      if (proposal.sourceKey === "funding_radar" && proposal.current?.snapshotId) {
        await linkFundingOpportunitiesToWorkflows(client, proposal.current.snapshotId, proposal.workflows);
      }
    }

    revalidatePath("/", "layout");
    span.setAttribute("freshcomply.action.outcome", "success");
    return { ok: true };
  });
}

export async function rejectPendingUpdate(id: string, reason: string): Promise<ModerationResult> {
  return withTelemetrySpan("action.freshness.reject", {
    attributes: {
      "freshcomply.action": "freshness.update.reject"
    }
  }, async (span) => {
    annotateSpan(span, { attributes: { "freshcomply.freshness.update_id": id } });

    const context = await resolveContext();
    const now = new Date().toISOString();
    if (!context) {
      span.setAttribute("freshcomply.action.outcome", "supabase_unavailable");
      return { ok: true };
    }

    const tenantOrgId = readOrgId(context.user, "tenant_org_id");
    const partnerOrgId = readOrgId(context.user, "partner_org_id");
    annotateSpan(span, { tenantId: tenantOrgId, partnerOrgId });

    const { client, user } = context;
    const { error } = await client
      .from("moderation_queue")
      .update({
        status: "rejected",
        notes_md: reason,
        reviewer_id: user?.id ?? null,
        decided_at: now,
        updated_at: now
      })
      .eq("id", id);

    if (error) {
      console.error("Unable to reject freshness update", error);
      span.setAttribute("freshcomply.action.outcome", "update_failed");
      return { ok: false, error: error.message };
    }

    revalidatePath("/", "layout");
    span.setAttribute("freshcomply.action.outcome", "success");
    return { ok: true };
  });
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
    .from("source_snapshot")
    .select("content_hash")
    .eq("id", snapshotId)
    .maybeSingle();

  if (snapshotError || !snapshot?.content_hash) {
    console.warn("Unable to resolve funding snapshot for workflow linking", snapshotError);
    return;
  }

  const { data: opportunities, error: fundingError } = await client
    .from("funding_opportunities")
    .select("id")
    .eq("snapshot_fingerprint", snapshot.content_hash);

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

function parseModerationProposal(value: Json | null): SourceModerationProposal | null {
  if (!value || typeof value !== "object") return null;
  const proposal = value as SourceModerationProposal;
  if (proposal.kind !== "source_change") return null;
  return {
    ...proposal,
    workflows: Array.isArray(proposal.workflows) ? proposal.workflows : []
  };
}
