import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCharitiesDataset } from "@airnub/connectors/charities";
import { lookupCompanyByName } from "@airnub/connectors/cro";
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
};

export type PollSourceOptions = {
  supabase?: SupabaseClient<Database>;
  workflows?: string[];
  metadata?: Record<string, unknown>;
  abortSignal?: AbortSignal;
};

type SourcePoller = (options?: { abortSignal?: AbortSignal }) => Promise<SourceRecord[]>;

const SOURCE_POLLERS: Record<SourceKey, SourcePoller> = {
  cro_open_services: async () => {
    // Poll most recent CRO name reservation sample
    return lookupCompanyByName("Fresh Example CLG");
  },
  charities_ckan: async () => {
    return fetchCharitiesDataset("company limited by guarantee");
  },
  revenue_charities: async () => {
    return fetchRevenueCharityRegistrations();
  }
};

export async function fetchSourceRecords(sourceKey: SourceKey, options?: { abortSignal?: AbortSignal }) {
  const poller = SOURCE_POLLERS[sourceKey];
  if (!poller) {
    throw new Error(`No poller registered for freshness source ${sourceKey}`);
  }
  return poller({ abortSignal: options?.abortSignal });
}

export async function pollSource(sourceKey: SourceKey, options: PollSourceOptions = {}): Promise<WatchEvent | null> {
  const records = await fetchSourceRecords(sourceKey, { abortSignal: options.abortSignal });
  const fingerprint = buildFingerprint(records);
  const detectedAt = new Date().toISOString();
  const supabase = options.supabase;

  const previous = supabase ? await loadPreviousSnapshot(supabase, sourceKey) : undefined;
  if (previous && previous.fingerprint === fingerprint) {
    return null;
  }

  const diff = diffRecords(previous?.payload ?? [], records);
  const summary = buildSummary(diff, records.length);
  const currentSnapshot = supabase
    ? await saveSnapshot(supabase, sourceKey, fingerprint, records, options.metadata)
    : { fingerprint, payload: records };

  if (supabase) {
    await persistPendingUpdate(supabase, {
      sourceKey,
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

async function loadPreviousSnapshot(client: SupabaseClient<Database>, sourceKey: SourceKey): Promise<PreviousSnapshot | undefined> {
  const { data, error } = await client
    .from("freshness_snapshots")
    .select("id, fingerprint, payload, metadata, polled_at")
    .eq("source_key", sourceKey)
    .order("polled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116" || error.message?.toLowerCase().includes("row")) {
      return undefined;
    }
    console.warn(`[freshness] Unable to load snapshot for ${sourceKey}`, error);
    return undefined;
  }

  if (!data) return undefined;

  return {
    fingerprint: data.fingerprint,
    payload: (data.payload as SourceRecord[]) ?? [],
    snapshotId: data.id
  } satisfies PreviousSnapshot;
}

async function saveSnapshot(
  client: SupabaseClient<Database>,
  sourceKey: SourceKey,
  fingerprint: string,
  payload: SourceRecord[],
  metadata?: Record<string, unknown>
): Promise<SnapshotInfo> {
  const { data, error } = await client
    .from("freshness_snapshots")
    .insert({
      source_key: sourceKey,
      fingerprint,
      payload: payload as unknown as Json,
      metadata: metadata ? (metadata as unknown as Json) : null,
      polled_at: new Date().toISOString()
    })
    .select("id, fingerprint, payload")
    .single();

  if (error) {
    throw new Error(`Unable to persist snapshot for ${sourceKey}: ${error.message}`);
  }

  return {
    fingerprint: data.fingerprint,
    payload: (data.payload as SourceRecord[]) ?? [],
    snapshotId: data.id
  } satisfies SnapshotInfo;
}

async function persistPendingUpdate(
  client: SupabaseClient<Database>,
  payload: {
    sourceKey: SourceKey;
    detectedAt: string;
    diff: SourceDiff;
    summary: string;
    current: SnapshotInfo;
    previous?: PreviousSnapshot;
    workflows?: string[];
  }
) {
  const { error } = await client.from("freshness_pending_updates").insert({
    source_key: payload.sourceKey,
    status: "pending",
    current_snapshot_id: payload.current.snapshotId,
    previous_snapshot_id: payload.previous?.snapshotId ?? null,
    diff_summary: payload.summary,
    diff_payload: {
      diff: payload.diff,
      current: payload.current.payload,
      previous: payload.previous?.payload ?? null
    } as unknown as Json,
    detected_at: payload.detectedAt,
    workflow_keys: payload.workflows ?? null
  });

  if (error) {
    console.error(`[freshness] Unable to persist pending update for ${payload.sourceKey}`, error);
  }
}

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
