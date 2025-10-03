import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCharitiesDataset } from "@airnub/connectors/charities";
import { lookupCompanyByName } from "@airnub/connectors/cro";
import { harvestFundingRadar } from "@airnub/connectors/funding";
import { fetchRevenueCharityRegistrations } from "@airnub/connectors/revenue";
import type { Database, Json } from "@airnub/types/supabase";
import { SOURCES } from "./sources.js";

export type SourceKey = keyof typeof SOURCES;

export type SourceRecord = Record<string, unknown>;

export type SourceDiff = {
  added: SourceRecord[];
  removed: SourceRecord[];
  changed: { key: string; before: SourceRecord; after: SourceRecord }[];
};

export type WatchEvent = {
  sourceKey: SourceKey;
  detectedAt: string;
  summary: string;
  diff: SourceDiff;
  current: SnapshotInfo;
  previous?: SnapshotInfo;
  workflows?: string[];
};

export type SnapshotInfo = {
  fingerprint: string;
  payload: SourceRecord[];
  snapshotId?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
};

export type PollSourceOptions = {
  supabase?: SupabaseClient<Database>;
  workflows?: string[];
  metadata?: Record<string, unknown>;
  tenantOrgId?: string;
  sourceRegistryId?: string;
  abortSignal?: AbortSignal;
};

type SourcePollerResult = {
  records: SourceRecord[];
  metadata?: Record<string, unknown>;
};

type SourcePoller = (options?: { abortSignal?: AbortSignal }) => Promise<SourcePollerResult>;

const SOURCE_POLLERS: Record<SourceKey, SourcePoller> = {
  cro_open_services: async ({ abortSignal } = {}) => {
    const result = await lookupCompanyByName("Fresh Example", { limit: 25, abortSignal });
    return {
      records: result.records,
      metadata: {
        resourceId: result.resourceId,
        total: result.total,
        issuedAt: result.issuedAt,
        query: "Fresh Example"
      }
    };
  },
  charities_ckan: async ({ abortSignal } = {}) => {
    const result = await fetchCharitiesDataset("registration", { abortSignal, limit: 50 });
    return {
      records: result.records,
      metadata: {
        resourceId: result.resourceId,
        total: result.total,
        issuedAt: result.issuedAt
      }
    };
  },
  revenue_charities: async ({ abortSignal } = {}) => {
    const result = await fetchRevenueCharityRegistrations({ abortSignal, limit: 250 });
    return {
      records: result.records,
      metadata: {
        resourceId: result.resourceId,
        total: result.total,
        issuedAt: result.issuedAt
      }
    };
  },
  funding_radar: async ({ abortSignal } = {}) => {
    const result = await harvestFundingRadar({ abortSignal, limit: 40 });
    return {
      records: result.records,
      metadata: {
        resourceId: result.resourceId,
        total: result.total,
        issuedAt: result.issuedAt
      }
    };
  }
};

export async function fetchSourceRecords(sourceKey: SourceKey, options?: { abortSignal?: AbortSignal }) {
  const poller = SOURCE_POLLERS[sourceKey];
  if (!poller) {
    throw new Error(`No poller registered for freshness source ${sourceKey}`);
  }
  const result = await poller({ abortSignal: options?.abortSignal });
  return result.records;
}

export async function pollSource(sourceKey: SourceKey, options: PollSourceOptions = {}): Promise<WatchEvent | null> {
  const poller = SOURCE_POLLERS[sourceKey];
  if (!poller) {
    throw new Error(`No poller registered for freshness source ${sourceKey}`);
  }

  const { records, metadata } = await poller({ abortSignal: options.abortSignal });
  const fingerprint = buildFingerprint(records);
  const detectedAt = new Date().toISOString();
  const supabase = options.supabase;

  let tenantOrgId: string | undefined = options.tenantOrgId;
  if (!tenantOrgId) {
    tenantOrgId = process.env.FRESHNESS_TENANT_ORG_ID;
  }

  let sourceRegistryId = options.sourceRegistryId;
  if (supabase) {
    if (!tenantOrgId) {
      throw new Error(`tenantOrgId must be provided when persisting freshness data for ${sourceKey}`);
    }
    sourceRegistryId = await resolveSourceRegistryId(supabase, tenantOrgId, sourceKey, sourceRegistryId);
  }

  const previous = supabase && tenantOrgId && sourceRegistryId
    ? await loadPreviousSnapshot(supabase, tenantOrgId, sourceRegistryId)
    : undefined;
  if (previous && previous.fingerprint === fingerprint) {
    return null;
  }

  const diff = diffRecords(previous?.payload ?? [], records);
  const summary = buildSummary(diff, records.length);
  const mergedMetadata = { ...(options.metadata ?? {}), ...(metadata ?? {}) };

  const currentSnapshot = supabase
    ? await saveSnapshot({
        client: supabase,
        sourceKey,
        sourceId: sourceRegistryId!,
        tenantOrgId: tenantOrgId!,
        fingerprint,
        payload: records,
        metadata: mergedMetadata
      })
    : { fingerprint, payload: records };

  if (supabase && tenantOrgId && sourceRegistryId) {
    await persistChangeEventAndProposal(supabase, {
      sourceKey,
      sourceId: sourceRegistryId,
      tenantOrgId,
      detectedAt,
      diff,
      summary,
      current: currentSnapshot,
      previous,
      workflows: options.workflows
    });
  }

  return {
    sourceKey,
    detectedAt,
    summary,
    diff,
    current: currentSnapshot,
    previous,
    workflows: options.workflows
  } satisfies WatchEvent;
}

type PreviousSnapshot = SnapshotInfo & { snapshotId: string };

async function loadPreviousSnapshot(
  client: SupabaseClient<Database>,
  tenantOrgId: string,
  sourceId: string
): Promise<PreviousSnapshot | undefined> {
  const { data, error } = await client
    .from("source_snapshot")
    .select("id, content_hash, parsed_facts, fetched_at")
    .eq("tenant_org_id", tenantOrgId)
    .eq("source_id", sourceId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116" || error.message?.toLowerCase().includes("row")) {
      return undefined;
    }
    console.warn(`[freshness] Unable to load snapshot for source ${sourceId}`, error);
    return undefined;
  }

  if (!data) return undefined;

  const parsed = (data.parsed_facts as { records?: SourceRecord[]; metadata?: Record<string, unknown> | null }) ?? {};

  return {
    fingerprint: data.content_hash,
    payload: Array.isArray(parsed.records) ? parsed.records : [],
    snapshotId: data.id,
    sourceId,
    metadata: (parsed.metadata ?? undefined) as Record<string, unknown> | undefined
  } satisfies PreviousSnapshot;
}

async function saveSnapshot(options: {
  client: SupabaseClient<Database>;
  tenantOrgId: string;
  sourceId: string;
  sourceKey: SourceKey;
  fingerprint: string;
  payload: SourceRecord[];
  metadata?: Record<string, unknown>;
}): Promise<SnapshotInfo> {
  const { client, tenantOrgId, sourceId, sourceKey, fingerprint, payload, metadata } = options;
  const { data, error } = await client
    .from("source_snapshot")
    .insert({
      tenant_org_id: tenantOrgId,
      source_id: sourceId,
      content_hash: fingerprint,
      parsed_facts: snapshotFacts(payload, metadata),
      storage_ref: null
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Unable to persist snapshot for ${sourceKey}: ${error.message}`);
  }

  return {
    fingerprint,
    payload,
    snapshotId: data.id,
    sourceId,
    metadata
  } satisfies SnapshotInfo;
}

async function persistChangeEventAndProposal(
  client: SupabaseClient<Database>,
  payload: {
    tenantOrgId: string;
    sourceId: string;
    sourceKey: SourceKey;
    detectedAt: string;
    diff: SourceDiff;
    summary: string;
    current: SnapshotInfo;
    previous?: PreviousSnapshot;
    workflows?: string[];
  }
) {
  const currentSnapshotId = payload.current.snapshotId;
  if (!currentSnapshotId) {
    throw new Error(`Missing current snapshot id for ${payload.sourceKey}`);
  }

  const severity = inferSeverity(payload.diff);

  const changeEventRow: Database["public"]["Tables"]["change_event"]["Insert"] = {
    tenant_org_id: payload.tenantOrgId,
    source_id: payload.sourceId,
    from_hash: payload.previous?.fingerprint ?? null,
    to_hash: payload.current.fingerprint,
    detected_at: payload.detectedAt,
    severity,
    notes: payload.summary
  };

  const { data: changeEvent, error: changeEventError } = await client
    .from("change_event")
    .insert(changeEventRow)
    .select("id")
    .single();

  if (changeEventError) {
    console.error(`[freshness] Unable to persist change event for ${payload.sourceKey}`, changeEventError);
    return;
  }

  const proposal = buildModerationProposal({
    sourceKey: payload.sourceKey,
    severity,
    summary: payload.summary,
    detectedAt: payload.detectedAt,
    diff: payload.diff,
    workflows: payload.workflows,
    current: payload.current,
    previous: payload.previous
  });

  const moderationRow: Database["public"]["Tables"]["moderation_queue"]["Insert"] = {
    tenant_org_id: payload.tenantOrgId,
    change_event_id: changeEvent.id,
    proposal,
    status: "pending",
    classification: null,
    reviewer_id: null,
    decided_at: null,
    created_by: null,
    notes_md: null
  };

  const { error: moderationError } = await client.from("moderation_queue").insert(moderationRow);

  if (moderationError) {
    console.error(`[freshness] Unable to enqueue moderation proposal for ${payload.sourceKey}`, moderationError);
  }
}

function snapshotFacts(
  payload: SourceRecord[],
  metadata?: Record<string, unknown>
): Json {
  return JSON.parse(
    JSON.stringify({ records: payload, metadata: metadata ?? null })
  ) as Json;
}

async function resolveSourceRegistryId(
  client: SupabaseClient<Database>,
  tenantOrgId: string,
  sourceKey: SourceKey,
  providedId?: string
): Promise<string> {
  if (providedId) {
    return providedId;
  }

  const sourceInfo = SOURCES[sourceKey];
  if (!sourceInfo) {
    throw new Error(`Unknown freshness source ${sourceKey}`);
  }

  const { data, error } = await client
    .from("source_registry")
    .select("id")
    .eq("tenant_org_id", tenantOrgId)
    .eq("url", sourceInfo.url)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to resolve source registry entry for ${sourceKey}: ${error.message}`);
  }

  if (data?.id) {
    return data.id;
  }

  const insertRow: Database["public"]["Tables"]["source_registry"]["Insert"] = {
    tenant_org_id: tenantOrgId,
    name: sourceInfo.label,
    url: sourceInfo.url,
    parser: sourceKey,
    jurisdiction: sourceInfo.jurisdiction ?? null,
    category: sourceInfo.category ?? null
  };

  const { data: created, error: insertError } = await client
    .from("source_registry")
    .insert(insertRow)
    .select("id")
    .single();

  if (insertError || !created?.id) {
    throw new Error(`Unable to register source ${sourceKey}: ${insertError?.message ?? "unknown error"}`);
  }

  return created.id;
}

function buildModerationProposal(input: {
  sourceKey: SourceKey;
  severity: string;
  summary: string;
  detectedAt: string;
  diff: SourceDiff;
  workflows?: string[];
  current: SnapshotInfo;
  previous?: PreviousSnapshot;
}): Json {
  const proposal = {
    kind: "source_change" as const,
    sourceKey: input.sourceKey,
    severity: input.severity,
    summary: input.summary,
    detectedAt: input.detectedAt,
    workflows: input.workflows ?? [],
    current: {
      snapshotId: input.current.snapshotId ?? null,
      fingerprint: input.current.fingerprint,
      records: input.current.payload,
      metadata: input.current.metadata ?? null
    },
    previous: input.previous
      ? {
          snapshotId: input.previous.snapshotId,
          fingerprint: input.previous.fingerprint,
          records: input.previous.payload,
          metadata: input.previous.metadata ?? null
        }
      : null,
    diff: input.diff
  } satisfies SourceModerationProposal;

  return JSON.parse(JSON.stringify(proposal)) as Json;
}

function inferSeverity(diff: SourceDiff): "patch" | "minor" | "major" {
  if (diff.removed.length > 0 || diff.changed.length >= 5) {
    return "major";
  }
  if (diff.changed.length > 0 || diff.added.length >= 5) {
    return "minor";
  }
  return diff.added.length > 0 ? "patch" : "patch";
}

type SourceModerationProposal = {
  kind: "source_change";
  sourceKey: SourceKey;
  severity: string;
  summary: string;
  detectedAt: string;
  workflows: string[];
  current: {
    snapshotId: string | null | undefined;
    fingerprint: string;
    records: SourceRecord[];
    metadata: Record<string, unknown> | null;
  };
  previous: null | {
    snapshotId: string | undefined;
    fingerprint: string;
    records: SourceRecord[];
    metadata: Record<string, unknown> | null;
  };
  diff: SourceDiff;
};

function buildSummary(diff: SourceDiff, total: number) {
  const parts = [] as string[];
  if (diff.added.length) parts.push(`${diff.added.length} added`);
  if (diff.removed.length) parts.push(`${diff.removed.length} removed`);
  if (diff.changed.length) parts.push(`${diff.changed.length} updated`);
  if (parts.length === 0) {
    parts.push("content changed");
  }
  return `${parts.join(", ")} · ${total} records`;
}

function diffRecords(previous: SourceRecord[], current: SourceRecord[]): SourceDiff {
  const previousMap = new Map<string, SourceRecord>();
  const currentMap = new Map<string, SourceRecord>();

  for (const record of previous) {
    previousMap.set(resolveRecordKey(record), record);
  }

  for (const record of current) {
    currentMap.set(resolveRecordKey(record), record);
  }

  const added: SourceRecord[] = [];
  const removed: SourceRecord[] = [];
  const changed: { key: string; before: SourceRecord; after: SourceRecord }[] = [];

  for (const [key, record] of currentMap) {
    const previousRecord = previousMap.get(key);
    if (!previousRecord) {
      added.push(record);
      continue;
    }
    if (!recordsEqual(previousRecord, record)) {
      changed.push({ key, before: previousRecord, after: record });
    }
  }

  for (const [key, record] of previousMap) {
    if (!currentMap.has(key)) {
      removed.push(record);
    }
  }

  return { added, removed, changed } satisfies SourceDiff;
}

function recordsEqual(a: SourceRecord, b: SourceRecord) {
  return canonicalStringify(a) === canonicalStringify(b);
}

function resolveRecordKey(record: SourceRecord): string {
  if (typeof record.id === "string" && record.id) return record.id;
  if (typeof record.registrationNumber === "string" && record.registrationNumber) return record.registrationNumber;
  if (typeof record.number === "string" && record.number) return record.number;
  if (typeof record.name === "string" && record.name) return record.name.toLowerCase();
  return createHash("sha1").update(canonicalStringify(record)).digest("hex");
}

function buildFingerprint(records: SourceRecord[]): string {
  const canonical = records.map((record) => canonicalStringify(record)).sort().join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

function canonicalStringify(value: unknown): string {
  return JSON.stringify(value, (_key, input) => {
    if (Array.isArray(input)) {
      return input;
    }
    if (input && typeof input === "object") {
      const sortedKeys = Object.keys(input as Record<string, unknown>).sort();
      return sortedKeys.reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = (input as Record<string, unknown>)[key];
        return acc;
      }, {});
    }
    return input;
  });
}

export { SOURCE_POLLERS, buildFingerprint };
