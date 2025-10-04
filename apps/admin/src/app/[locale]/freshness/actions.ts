"use server";

import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
import {
  getSupabaseClient,
  getSupabaseUser,
  SupabaseConfigurationError
} from "../../../lib/auth/supabase-ssr";
import {
  getSupabaseServiceRoleClient,
  SupabaseServiceRoleConfigurationError
} from "../../../lib/auth/supabase-service-role";
import { annotateSpan, withTelemetrySpan } from "@airnub/utils/telemetry";
import { publishApprovedProposal } from "@airnub/freshness/watcher";
import type { Database } from "@airnub/types";

type ModerationResult = { ok: boolean; error?: string };

type PlatformDetection = Database["platform"]["Tables"]["rule_pack_detections"]["Row"];

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

function resolveServiceClient() {
  try {
    return getSupabaseServiceRoleClient();
  } catch (error) {
    if (error instanceof SupabaseServiceRoleConfigurationError) {
      console.warn("Service role unavailable for freshness moderation", error.message);
      return null;
    }
    console.error("Unexpected service role error during freshness moderation", error);
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
    if (!context) {
      span.setAttribute("freshcomply.action.outcome", "supabase_unavailable");
      return { ok: true };
    }

    const service = resolveServiceClient();
    if (!service) {
      span.setAttribute("freshcomply.action.outcome", "service_unavailable");
      return { ok: false, error: "Moderation service unavailable" };
    }

    const tenantOrgId = readOrgId(context.user, "org_id");
    const partnerOrgId = readOrgId(context.user, "partner_org_id");
    annotateSpan(span, { tenantId: tenantOrgId, partnerOrgId });

    const { client, user } = context;
    let detectionId: string | null = null;
    try {
      detectionId = await moderateProposal(service, id, "approved", reason);
    } catch (error) {
      console.error("Unable to approve rule pack proposal", error);
      span.setAttribute("freshcomply.action.outcome", "update_failed");
      return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
    }

    if (!detectionId) {
      span.setAttribute("freshcomply.action.outcome", "not_found");
      return { ok: false, error: "Proposal not found" };
    }

    let detection: PlatformDetection | null = null;
    try {
      detection = await publishApprovedProposal(service.schema("platform"), {
        proposalId: id,
        reviewNotes: reason
      });
    } catch (error) {
      console.error("Unable to publish approved rule pack proposal", error);
      span.setAttribute("freshcomply.action.outcome", "publish_failed");
      return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
    }

    if (!detection) {
      detection = await loadDetection(service, detectionId);
    }

    if (!detection) {
      span.setAttribute("freshcomply.action.outcome", "not_found");
      return { ok: false, error: "Detection not found" };
    }

    const diffRecord = toRecord(detection.diff);
    const workflows = extractImpactedWorkflows(diffRecord);
    const snapshotFingerprint = extractSnapshotFingerprint(diffRecord);

    if (workflows.length) {
      await bumpWorkflowVersions(client, workflows);
      if (detection.rule_pack_key === "funding_radar" && snapshotFingerprint) {
        await linkFundingOpportunitiesToWorkflows(client, snapshotFingerprint, workflows);
      }
    }

    await appendModerationAudit(
      client,
      user?.id ?? null,
      detection.id,
      reason,
      "approve",
      tenantOrgId,
      partnerOrgId
    );

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
    if (!context) {
      span.setAttribute("freshcomply.action.outcome", "supabase_unavailable");
      return { ok: true };
    }

    const service = resolveServiceClient();
    if (!service) {
      span.setAttribute("freshcomply.action.outcome", "service_unavailable");
      return { ok: false, error: "Moderation service unavailable" };
    }

    const tenantOrgId = readOrgId(context.user, "org_id");
    const partnerOrgId = readOrgId(context.user, "partner_org_id");
    annotateSpan(span, { tenantId: tenantOrgId, partnerOrgId });

    const { client, user } = context;
    let detectionId: string | null = null;
    try {
      detectionId = await moderateProposal(service, id, "rejected", reason);
    } catch (error) {
      console.error("Unable to reject rule pack proposal", error);
      span.setAttribute("freshcomply.action.outcome", "update_failed");
      return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
    }

    if (!detectionId) {
      span.setAttribute("freshcomply.action.outcome", "not_found");
      return { ok: false, error: "Proposal not found" };
    }

    await appendModerationAudit(
      client,
      user?.id ?? null,
      detectionId,
      reason,
      "reject",
      tenantOrgId,
      partnerOrgId
    );

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
  snapshotFingerprint: string,
  workflowKeys: string[]
) {
  if (!workflowKeys.length) return;
  const { data: opportunities, error: fundingError } = await client
    .from("funding_opportunities")
    .select("id")
    .eq("snapshot_fingerprint", snapshotFingerprint);

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

async function moderateProposal(
  service: ReturnType<typeof getSupabaseServiceRoleClient>,
  proposalId: string,
  status: "approved" | "rejected",
  reason: string
): Promise<string | null> {
  const now = new Date().toISOString();
  const updates: Database["platform"]["Tables"]["rule_pack_proposals"]["Update"] = {
    status,
    review_notes: reason,
    updated_at: now,
    approved_at: status === "approved" ? now : null
  };

  const { data, error } = await service
    .schema("platform")
    .from("rule_pack_proposals")
    .update(updates)
    .eq("id", proposalId)
    .select("detection_id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  const detectionId = data?.detection_id ?? null;

  if (detectionId && status === "rejected") {
    const { error: detectionError } = await service
      .schema("platform")
      .from("rule_pack_detections")
      .update({ status: "rejected", notes: reason })
      .eq("id", detectionId);

    if (detectionError) {
      console.warn("Unable to update detection status after rejection", detectionError);
    }
  }

  return detectionId;
}

async function loadDetection(
  service: ReturnType<typeof getSupabaseServiceRoleClient>,
  detectionId: string
): Promise<PlatformDetection | null> {
  const { data, error } = await service
    .schema("platform")
    .from("rule_pack_detections")
    .select("id, rule_pack_key, diff, severity, proposed_version, current_version")
    .eq("id", detectionId)
    .maybeSingle();

  if (error) {
    console.error("Unable to load detection for proposal moderation", error);
    return null;
  }

  return (data as PlatformDetection) ?? null;
}

function extractImpactedWorkflows(diff: Record<string, unknown> | null): string[] {
  if (!diff) return [];

  const candidates = [
    diff.workflows,
    diff.workflowKeys,
    diff.workflow_keys,
    diff.impactedWorkflows,
    diff.impacted_workflows,
    toRecord(diff.metadata)?.workflows,
    toRecord(diff.metadata)?.workflowKeys,
    toRecord(diff.metadata)?.workflow_keys,
  ];

  const values = new Set<string>();
  for (const candidate of candidates) {
    for (const entry of coerceStringArray(candidate)) {
      values.add(entry);
    }
  }

  return Array.from(values);
}

function extractSnapshotFingerprint(diff: Record<string, unknown> | null): string | null {
  if (!diff) return null;

  const candidates: unknown[] = [
    diff.snapshotFingerprint,
    diff.snapshot_fingerprint,
    toRecord(diff.current)?.fingerprint,
    toRecord(diff.snapshots)?.current && toRecord(toRecord(diff.snapshots)?.current)?.fingerprint,
    toRecord(diff.metadata)?.snapshotFingerprint,
    toRecord(diff.metadata)?.snapshot_fingerprint,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  return null;
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

async function appendModerationAudit(
  client: ReturnType<typeof getSupabaseClient>,
  actorId: string | null,
  detectionId: string,
  reason: string,
  action: "approve" | "reject",
  tenantOrgId: string | null,
  partnerOrgId: string | null
) {
  const procedure = action === "approve" ? "admin_approve_freshness_diff" : "admin_reject_freshness_diff";

  try {
    const { error } = await client.rpc(procedure, {
      actor_id: actorId,
      reason,
      diff_id: detectionId,
      notes: reason,
      org_id: tenantOrgId,
      actor_org_id: partnerOrgId ?? tenantOrgId,
      on_behalf_of_org_id: partnerOrgId ?? tenantOrgId,
      subject_org_id: tenantOrgId,
    });

    if (error) {
      console.warn(`Unable to append ${action} freshness audit entry`, error);
    }
  } catch (error) {
    console.warn(`RPC ${procedure} failed`, error);
  }
}
