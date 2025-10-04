import type { SourceDiff } from "@airnub/freshness/watcher";
import { SOURCE_POLLERS } from "@airnub/freshness/watcher";
import { getSupabaseClient, SupabaseConfigurationError } from "../lib/auth/supabase-ssr";
import {
  getSupabaseServiceRoleClient,
  SupabaseServiceRoleConfigurationError
} from "../lib/auth/supabase-service-role";
import type { Database } from "@airnub/types";
import type { Json } from "@airnub/types/supabase";

type PendingUpdate = {
  id: string;
  sourceKey: string;
  summary: string;
  detectedAt: string;
  status: "pending" | "approved" | "rejected" | "amended";
  workflows: string[];
  diff: SourceDiff;
  current: unknown;
  previous: unknown;
  severity?: string;
  packTitle?: string | null;
  proposedVersion?: string;
  currentVersion?: string | null;
  sources?: DetectionSourceSummary[];
  notes?: string | null;
  verifiedAt?: string | null;
};

type DetectionSourceSummary = {
  id: string;
  name: string | null;
  changeSummary: Json | null;
};

type PlatformDetectionRow = Database["platform"]["Tables"]["rule_pack_detections"]["Row"] & {
  rule_packs?: { title: string | null } | null;
  detection_sources?: ({
    rule_source?: { name: string | null } | null;
  } & Database["platform"]["Tables"]["rule_pack_detection_sources"]["Row"])[] | null;
};

function buildFallback(): PendingUpdate[] {
  const detectedAt = new Date().toISOString();
  return [
    {
      id: "demo-cro",
      sourceKey: "cro_open_services",
      summary: "CRO Open Services 1.2.0 → 1.2.1",
      detectedAt,
      status: "pending",
      workflows: ["setup-nonprofit-ie"],
      severity: "minor",
      packTitle: "CRO Open Services",
      proposedVersion: "1.2.1",
      currentVersion: "1.2.0",
      diff: {
        added: [
          {
            name: "Fresh Example CLG",
            number: "000000",
            status: "AVAILABLE_OR_MOCK"
          }
        ],
        removed: [],
        changed: []
      },
      current: [],
      previous: []
    }
  ];
}

export async function getPendingFreshnessUpdates(): Promise<PendingUpdate[]> {
  try {
    const supabase = getSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .schema("platform")
      .from("rule_pack_detections")
      .select(
        `
          id,
          rule_pack_key,
          current_version,
          proposed_version,
          severity,
          status,
          diff,
          detected_at,
          notes,
          rule_packs:rule_pack_id(title),
          detection_sources:rule_pack_detection_sources(
            rule_source_id,
            change_summary,
            rule_source:rule_sources(name)
          )
        `
      )
      .in("status", ["open", "in_review"])
      .order("detected_at", { ascending: false });

    if (error) {
      throw error;
    }

    if (!data?.length) {
      return [];
    }

    return data.map(mapPlatformDetectionToPendingUpdate).filter(Boolean) as PendingUpdate[];
  } catch (error) {
    if (
      !(
        error instanceof SupabaseConfigurationError ||
        error instanceof SupabaseServiceRoleConfigurationError
      )
    ) {
      console.warn("Unable to fetch freshness updates", error);
    }
    return buildFallback();
  }
}

function mapPlatformDetectionToPendingUpdate(row: PlatformDetectionRow | null): PendingUpdate | null {
  if (!row) return null;

  const diffRecord = toRecord(row.diff);
  const workflows = diffRecord ? extractWorkflows(diffRecord) : [];
  const summary = resolveDetectionSummary(row, diffRecord);
  const current = resolveSnapshot(diffRecord, "current");
  const previous = resolveSnapshot(diffRecord, "previous");
  const verifiedAt = extractTimestamp(
    diffRecord?.verifiedAt ??
      diffRecord?.verified_at ??
      toRecord(diffRecord?.metadata)?.verifiedAt ??
      toRecord(diffRecord?.metadata)?.verified_at ??
      null
  );

  return {
    id: row.id,
    sourceKey: row.rule_pack_key,
    summary,
    detectedAt: row.detected_at ?? new Date().toISOString(),
    status: mapDetectionStatus(row.status),
    workflows,
    diff: extractSourceDiff(diffRecord),
    current,
    previous,
    severity: row.severity ?? undefined,
    packTitle: row.rule_packs?.title ?? null,
    proposedVersion: row.proposed_version ?? undefined,
    currentVersion: row.current_version ?? null,
    sources: (row.detection_sources ?? []).map(mapDetectionSource),
    notes: row.notes ?? null,
    verifiedAt,
  } satisfies PendingUpdate;
}

function mapDetectionSource(source: PlatformDetectionRow["detection_sources"][number]): DetectionSourceSummary {
  return {
    id: source.rule_source_id,
    name: source.rule_source?.name ?? null,
    changeSummary: (source.change_summary ?? null) as Json | null,
  };
}

const EMPTY_DIFF: SourceDiff = { added: [], removed: [], changed: [] };

function extractSourceDiff(record: Record<string, unknown> | null): SourceDiff {
  if (!record) {
    return EMPTY_DIFF;
  }

  const candidate = toRecord(record.diff) ?? record;
  const added = Array.isArray(candidate.added) ? candidate.added : [];
  const removed = Array.isArray(candidate.removed) ? candidate.removed : [];
  const changed = Array.isArray(candidate.changed) ? candidate.changed : [];

  return {
    added: added as SourceDiff["added"],
    removed: removed as SourceDiff["removed"],
    changed: changed as SourceDiff["changed"],
  } satisfies SourceDiff;
}

function extractWorkflows(record: Record<string, unknown>): string[] {
  const candidates = [
    record.workflows,
    record.workflowKeys,
    record.workflow_keys,
    record.impactedWorkflows,
    record.impacted_workflows,
    toRecord(record.metadata)?.workflows,
    toRecord(record.metadata)?.workflowKeys,
    toRecord(record.metadata)?.workflow_keys,
  ];

  const values = new Set<string>();
  for (const candidate of candidates) {
    for (const entry of coerceStringArray(candidate)) {
      values.add(entry);
    }
  }

  return Array.from(values);
}

function resolveDetectionSummary(
  row: PlatformDetectionRow,
  diff: Record<string, unknown> | null
): string {
  const fromDiff = pickString(diff, ["summary", "headline", "description"]);
  if (fromDiff) {
    return fromDiff;
  }

  const label = row.rule_packs?.title ?? row.rule_pack_key;
  if (row.current_version) {
    return `${label} ${row.current_version} → ${row.proposed_version}`;
  }

  return `${label} ${row.proposed_version}`;
}

function resolveSnapshot(diff: Record<string, unknown> | null, key: "current" | "previous") {
  if (!diff) return null;

  if (key in diff) {
    return diff[key];
  }

  const snapshots =
    toRecord(diff.snapshots) ?? toRecord(diff.snapshot) ?? toRecord(diff.payload) ?? toRecord(diff.state);
  if (snapshots && key in snapshots) {
    return snapshots[key];
  }

  return null;
}

function mapDetectionStatus(status: string | null | undefined): PendingUpdate["status"] {
  switch (status) {
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "superseded":
      return "amended";
    default:
      return "pending";
  }
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function pickString(record: Record<string, unknown> | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function extractTimestamp(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return null;
}

export function resolveSourceLabel(sourceKey: keyof typeof SOURCE_POLLERS) {
  switch (sourceKey) {
    case "cro_open_services":
      return "CRO Open Services";
    case "charities_ckan":
      return "Charities Regulator (CKAN)";
    case "revenue_charities":
      return "Revenue Charities";
    default:
      return sourceKey;
  }
}

export type { PendingUpdate };
