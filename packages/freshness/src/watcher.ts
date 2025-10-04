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
  ruleSourceId?: string;
  rulePack?: {
    id?: string | null;
    key?: string;
    currentVersion?: string | null;
    proposedVersion?: string;
  };
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

  const platformClient = supabase?.schema("platform") as PlatformClient | undefined;
  let ruleSourceId = options.ruleSourceId;

  if (platformClient) {
    ruleSourceId = await resolvePlatformRuleSourceId(platformClient, sourceKey, ruleSourceId);
  }

  const previous = platformClient && ruleSourceId
    ? await loadPreviousPlatformSnapshot(platformClient, ruleSourceId)
    : undefined;
  if (previous && previous.fingerprint === fingerprint) {
    return null;
  }

  const diff = diffRecords(previous?.payload ?? [], records);
  const summary = buildSummary(diff, records.length);
  const mergedMetadata = { ...(options.metadata ?? {}), ...(metadata ?? {}) };

  const currentSnapshot = platformClient && ruleSourceId
    ? await savePlatformSnapshot({
        client: platformClient,
        sourceKey,
        ruleSourceId,
        fingerprint,
        payload: records,
        metadata: mergedMetadata
      })
    : { fingerprint, payload: records };

  if (platformClient && ruleSourceId) {
    await persistPlatformDetection(platformClient, {
      sourceKey,
      ruleSourceId,
      detectedAt,
      diff,
      summary,
      current: currentSnapshot,
      previous,
      workflows: options.workflows,
      rulePack: options.rulePack
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

type PlatformClient = ReturnType<SupabaseClient<Database>["schema"]>;

type PlatformProposalRow = Database["platform"]["Tables"]["rule_pack_proposals"]["Row"];
type PlatformDetectionRow = Database["platform"]["Tables"]["rule_pack_detections"]["Row"];
type PlatformRulePackRow = Database["platform"]["Tables"]["rule_packs"]["Row"];

async function loadPreviousPlatformSnapshot(
  client: PlatformClient,
  ruleSourceId: string
): Promise<PreviousSnapshot | undefined> {
  try {
    const { data, error } = await client
      .from("rule_source_snapshots")
      .select("id, content_hash, parsed_facts, fetched_at")
      .eq("rule_source_id", ruleSourceId)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === "PGRST116" || error.message?.toLowerCase().includes("row")) {
        return undefined;
      }
      if (error.code === "42P01") {
        console.warn("[freshness] Platform snapshot table missing; skipping history lookup");
        return undefined;
      }
      console.warn(`[freshness] Unable to load platform snapshot for source ${ruleSourceId}`, error);
      return undefined;
    }

    if (!data) return undefined;

    const parsed =
      (data.parsed_facts as { records?: SourceRecord[]; metadata?: Record<string, unknown> | null }) ?? {};

    return {
      fingerprint: data.content_hash,
      payload: Array.isArray(parsed.records) ? parsed.records : [],
      snapshotId: data.id,
      sourceId: ruleSourceId,
      metadata: (parsed.metadata ?? undefined) as Record<string, unknown> | undefined
    } satisfies PreviousSnapshot;
  } catch (error) {
    console.warn(`[freshness] Unexpected error loading platform snapshot for source ${ruleSourceId}`, error);
    return undefined;
  }
}

async function savePlatformSnapshot(options: {
  client: PlatformClient;
  ruleSourceId: string;
  sourceKey: SourceKey;
  fingerprint: string;
  payload: SourceRecord[];
  metadata?: Record<string, unknown>;
}): Promise<SnapshotInfo> {
  const { client, ruleSourceId, sourceKey, fingerprint, payload, metadata } = options;

  try {
    const { data, error } = await client
      .from("rule_source_snapshots")
      .insert({
        rule_source_id: ruleSourceId,
        content_hash: fingerprint,
        parsed_facts: snapshotFacts(payload, metadata)
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "42P01") {
        console.warn("[freshness] Platform snapshot table missing; skipping snapshot persistence");
        return { fingerprint, payload, sourceId: ruleSourceId, metadata } satisfies SnapshotInfo;
      }
      throw new Error(`Unable to persist platform snapshot for ${sourceKey}: ${error.message}`);
    }

    return {
      fingerprint,
      payload,
      snapshotId: data.id,
      sourceId: ruleSourceId,
      metadata
    } satisfies SnapshotInfo;
  } catch (error) {
    if ((error as { message?: string })?.message?.includes("Unable to persist")) {
      throw error;
    }
    console.warn(`[freshness] Unexpected error persisting platform snapshot for ${sourceKey}`, error);
    return { fingerprint, payload, sourceId: ruleSourceId, metadata } satisfies SnapshotInfo;
  }
}

async function persistPlatformDetection(
  client: PlatformClient,
  payload: {
    sourceKey: SourceKey;
    ruleSourceId: string;
    detectedAt: string;
    diff: SourceDiff;
    summary: string;
    current: SnapshotInfo;
    previous?: PreviousSnapshot;
    workflows?: string[];
    rulePack?: PollSourceOptions["rulePack"];
  }
) {
  const severity = mapDetectionSeverity(inferSeverity(payload.diff));
  const rulePackKey = payload.rulePack?.key ?? `source:${payload.sourceKey}`;
  const proposedVersion =
    payload.rulePack?.proposedVersion ?? bumpVersion(payload.rulePack?.currentVersion ?? null, severity);

  const detectionDiff = normalizeJson({
    sourceKey: payload.sourceKey,
    summary: payload.summary,
    diff: payload.diff,
    workflows: payload.workflows ?? [],
    current: serializeSnapshot(payload.current),
    previous: payload.previous ? serializeSnapshot(payload.previous) : null
  });

  try {
    const { data: detection, error: detectionError } = await client
      .from("rule_pack_detections" as never)
      .insert({
        rule_pack_id: payload.rulePack?.id ?? null,
        rule_pack_key: rulePackKey,
        current_version: payload.rulePack?.currentVersion ?? null,
        proposed_version: proposedVersion,
        severity,
        diff: detectionDiff,
        detected_at: payload.detectedAt,
        status: "open",
        notes: payload.summary
      })
      .select("id")
      .single();

    if (detectionError) {
      if (detectionError.code === "42P01") {
        console.warn("[freshness] Platform detection table missing; skipping detection persistence");
        return;
      }
      console.error(`[freshness] Unable to persist platform detection for ${payload.sourceKey}`, detectionError);
      return;
    }

    if (!detection?.id) {
      console.warn(`[freshness] Detection persisted without id for ${payload.sourceKey}; skipping proposal`);
      return;
    }

    await persistPlatformProposal(client, {
      detectionId: detection.id,
      rulePackId: payload.rulePack?.id ?? null,
      rulePackKey,
      currentVersion: payload.rulePack?.currentVersion ?? null,
      proposedVersion,
      severity,
      summary: payload.summary,
      diff: payload.diff,
      workflows: payload.workflows ?? [],
      currentSnapshot: payload.current,
      previousSnapshot: payload.previous,
      detectedAt: payload.detectedAt,
      sourceKey: payload.sourceKey
    });

    const changeSummary = normalizeJson({
      sourceKey: payload.sourceKey,
      fingerprint: payload.current.fingerprint,
      previousFingerprint: payload.previous?.fingerprint ?? null,
      workflows: payload.workflows ?? [],
      diff: payload.diff,
      snapshots: {
        current: serializeSnapshot(payload.current),
        previous: payload.previous ? serializeSnapshot(payload.previous) : null
      }
    });

    const { error: sourceLinkError } = await client
      .from("rule_pack_detection_sources" as never)
      .insert({
        detection_id: detection.id,
        rule_source_id: payload.ruleSourceId,
        change_summary: changeSummary
      });

    if (sourceLinkError) {
      if (sourceLinkError.code === "42P01") {
        console.warn(
          "[freshness] Platform detection sources table missing; skipping detection source persistence"
        );
        return;
      }
      console.error(
        `[freshness] Unable to persist platform detection source link for ${payload.sourceKey}`,
        sourceLinkError
      );
    }
  } catch (error) {
    console.error(`[freshness] Unexpected error persisting platform detection for ${payload.sourceKey}`, error);
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

async function resolvePlatformRuleSourceId(
  client: PlatformClient,
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

  try {
    const { data, error } = await client
      .from("rule_sources" as never)
      .select("id")
      .eq("url", sourceInfo.url)
      .maybeSingle();

    if (error) {
      if (error.code === "42P01") {
        throw new Error("platform.rule_sources table missing; service role access required");
      }
      throw new Error(`Unable to resolve platform rule source entry for ${sourceKey}: ${error.message}`);
    }

    if (data?.id) {
      return data.id;
    }

    const insertRow = {
      name: sourceInfo.label,
      url: sourceInfo.url,
      parser: sourceKey,
      jurisdiction: sourceInfo.jurisdiction ?? null,
      category: sourceInfo.category ?? null,
      metadata: normalizeJson({})
    } satisfies Database["platform"]["Tables"]["rule_sources"]["Insert"];

    const { data: created, error: insertError } = await client
      .from("rule_sources" as never)
      .insert(insertRow)
      .select("id")
      .single();

    if (insertError || !created?.id) {
      throw new Error(
        `Unable to register platform rule source ${sourceKey}: ${insertError?.message ?? "unknown error"}`
      );
    }

    return created.id;
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error(`Unable to resolve platform rule source entry for ${sourceKey}: ${String(error)}`);
  }
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

function normalizeJson<T>(value: T): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

type DetectionSeverity = Database["platform"]["Tables"]["rule_pack_detections"]["Row"]["severity"];

function mapDetectionSeverity(severity: "patch" | "minor" | "major"): DetectionSeverity {
  switch (severity) {
    case "major":
      return "major";
    case "minor":
      return "minor";
    case "patch":
    default:
      return "info";
  }
}

function bumpVersion(currentVersion: string | null, severity: DetectionSeverity): string {
  const defaultVersion = "0.0.0";
  const [major, minor, patch] = (currentVersion ?? defaultVersion).split(".").map((part) => Number(part) || 0);

  switch (severity) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "critical":
      return `${major + 1}.0.0`;
    case "info":
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

function serializeSnapshot(snapshot: SnapshotInfo) {
  return {
    snapshotId: snapshot.snapshotId ?? null,
    fingerprint: snapshot.fingerprint,
    metadata: snapshot.metadata ?? null,
    sourceId: snapshot.sourceId ?? null,
    recordCount: Array.isArray(snapshot.payload) ? snapshot.payload.length : null
  };
}

async function persistPlatformProposal(
  client: PlatformClient,
  payload: {
    detectionId: string;
    rulePackId: string | null;
    rulePackKey: string;
    currentVersion: string | null;
    proposedVersion: string;
    severity: DetectionSeverity;
    summary: string;
    diff: SourceDiff;
    workflows: string[];
    currentSnapshot: SnapshotInfo;
    previousSnapshot?: PreviousSnapshot;
    detectedAt: string;
    sourceKey: SourceKey;
    createdBy?: string | null;
  }
) {
  const changelog = buildProposalChangelog(payload);
  const now = new Date().toISOString();

  try {
    const { data: existing, error: fetchError } = await client
      .from("rule_pack_proposals" as never)
      .select("*")
      .eq("detection_id", payload.detectionId)
      .maybeSingle();

    if (fetchError) {
      if (fetchError.code === "42P01") {
        console.warn("[freshness] Platform proposal table missing; skipping proposal persistence");
        return;
      }
      throw fetchError;
    }

    if (!existing) {
      const insertRow: Database["platform"]["Tables"]["rule_pack_proposals"]["Insert"] = {
        detection_id: payload.detectionId,
        rule_pack_id: payload.rulePackId,
        rule_pack_key: payload.rulePackKey,
        current_version: payload.currentVersion,
        proposed_version: payload.proposedVersion,
        changelog,
        status: "pending",
        review_notes: null,
        created_by: payload.createdBy ?? null,
        updated_at: now,
        created_at: payload.detectedAt
      };

      const { error: insertError } = await client
        .from("rule_pack_proposals" as never)
        .insert(insertRow);

      if (insertError) {
        if (insertError.code === "42P01") {
          console.warn("[freshness] Platform proposal table missing; skipping proposal persistence");
          return;
        }
        throw insertError;
      }
    } else {
      if (["approved", "rejected", "published", "superseded"].includes(existing.status)) {
        return;
      }

      const nextStatus: PlatformProposalRow["status"] =
        existing.status === "in_review" ? "in_review" : "pending";

      const { error: updateError } = await client
        .from("rule_pack_proposals" as never)
        .update({
          changelog,
          proposed_version: payload.proposedVersion,
          current_version: payload.currentVersion,
          rule_pack_key: payload.rulePackKey,
          rule_pack_id: payload.rulePackId ?? existing.rule_pack_id ?? null,
          status: nextStatus,
          updated_at: now
        })
        .eq("id", existing.id);

      if (updateError) {
        throw updateError;
      }
    }

    await client
      .from("rule_pack_detections" as never)
      .update({ status: "in_review" as PlatformDetectionRow["status"] })
      .eq("id", payload.detectionId)
      .eq("status", "open");
  } catch (error) {
    console.error(
      `[freshness] Unable to persist platform proposal for ${payload.rulePackKey}`,
      error
    );
  }
}

export async function publishApprovedProposal(
  client: PlatformClient,
  options: { proposalId: string; reviewNotes?: string | null }
): Promise<PlatformDetectionRow | null> {
  const { proposalId, reviewNotes } = options;
  const publishedAt = new Date().toISOString();

  try {
    const { data: proposal, error: proposalError } = await client
      .from("rule_pack_proposals" as never)
      .select("*")
      .eq("id", proposalId)
      .maybeSingle();

    if (proposalError) {
      if (proposalError.code === "42P01") {
        console.warn("[freshness] Proposal table missing; cannot publish");
        return null;
      }
      throw proposalError;
    }

    if (!proposal) {
      return null;
    }

    if (proposal.status !== "approved") {
      console.warn(`[freshness] Proposal ${proposalId} is not approved; skipping publish`);
      return null;
    }

    const { data: detection, error: detectionError } = await client
      .from("rule_pack_detections" as never)
      .select("*")
      .eq("id", proposal.detection_id)
      .maybeSingle();

    if (detectionError) {
      throw detectionError;
    }

    if (!detection) {
      throw new Error(`Detection ${proposal.detection_id} missing for proposal ${proposalId}`);
    }

    const basePack = await loadBaseRulePack(client, proposal, detection);

    const manifestSource = deriveManifestSource(basePack, detection, proposal);
    const checksumPayload = JSON.stringify({
      rulePackKey: proposal.rule_pack_key ?? detection.rule_pack_key,
      proposedVersion: proposal.proposed_version,
      diff: detection.diff,
      changelog: proposal.changelog
    });

    const packInsert: Database["platform"]["Tables"]["rule_packs"]["Insert"] = {
      pack_key: proposal.rule_pack_key ?? detection.rule_pack_key,
      version: proposal.proposed_version,
      title: basePack?.title ?? detection.rule_pack_key,
      summary: deriveProposalSummary(proposal, detection, basePack),
      manifest: manifestSource,
      checksum: createHash("sha256").update(checksumPayload).digest("hex"),
      status: "published",
      published_at: publishedAt,
      created_by: basePack?.created_by ?? proposal.created_by ?? detection.created_by ?? null
    };

    const { error: packError } = await client
      .from("rule_packs" as never)
      .upsert(packInsert, { onConflict: "pack_key,version" });

    if (packError) {
      throw packError;
    }

    const { data: publishedPack, error: fetchPackError } = await client
      .from("rule_packs" as never)
      .select("id")
      .eq("pack_key", packInsert.pack_key)
      .eq("version", packInsert.version)
      .maybeSingle();

    if (fetchPackError) {
      throw fetchPackError;
    }

    const { data: updatedDetection, error: detectionUpdateError } = await client
      .from("rule_pack_detections" as never)
      .update({
        status: "approved" as PlatformDetectionRow["status"],
        notes: reviewNotes ?? detection.notes ?? null
      })
      .eq("id", detection.id)
      .select("*")
      .maybeSingle();

    if (detectionUpdateError) {
      throw detectionUpdateError;
    }

    const { error: proposalUpdateError } = await client
      .from("rule_pack_proposals" as never)
      .update({
        status: "published" as PlatformProposalRow["status"],
        rule_pack_id: publishedPack?.id ?? proposal.rule_pack_id ?? null,
        published_at: publishedAt,
        review_notes: reviewNotes ?? proposal.review_notes ?? null,
        updated_at: publishedAt
      })
      .eq("id", proposal.id);

    if (proposalUpdateError) {
      throw proposalUpdateError;
    }

    return (updatedDetection ?? detection) as PlatformDetectionRow;
  } catch (error) {
    console.error(`[freshness] Unable to publish rule pack proposal ${proposalId}`, error);
    throw error instanceof Error ? error : new Error(String(error));
  }
}

function buildProposalChangelog(payload: {
  sourceKey: SourceKey;
  summary: string;
  severity: DetectionSeverity;
  diff: SourceDiff;
  workflows: string[];
  currentSnapshot: SnapshotInfo;
  previousSnapshot?: PreviousSnapshot;
  detectedAt: string;
}): Json {
  return normalizeJson({
    sourceKey: payload.sourceKey,
    summary: payload.summary,
    severity: payload.severity,
    workflows: payload.workflows,
    diff: payload.diff,
    detectedAt: payload.detectedAt,
    snapshots: {
      current: serializeSnapshot(payload.currentSnapshot),
      previous: payload.previousSnapshot ? serializeSnapshot(payload.previousSnapshot) : null
    }
  });
}

async function loadBaseRulePack(
  client: PlatformClient,
  proposal: PlatformProposalRow,
  detection: PlatformDetectionRow
): Promise<PlatformRulePackRow | null> {
  const packId = proposal.rule_pack_id ?? detection.rule_pack_id;
  if (!packId) {
    return null;
  }

  const { data, error } = await client
    .from("rule_packs" as never)
    .select("*")
    .eq("id", packId)
    .maybeSingle();

  if (error) {
    console.warn(`Unable to load base rule pack ${packId} for proposal ${proposal.id}`, error);
    return null;
  }

  return (data as PlatformRulePackRow) ?? null;
}

function deriveManifestSource(
  basePack: PlatformRulePackRow | null,
  detection: PlatformDetectionRow,
  proposal: PlatformProposalRow
): Json {
  if (basePack?.manifest) {
    return basePack.manifest as Json;
  }

  return normalizeJson({
    baselineVersion: proposal.current_version ?? detection.current_version ?? null,
    diff: detection.diff,
    changelog: proposal.changelog
  });
}

function deriveProposalSummary(
  proposal: PlatformProposalRow,
  detection: PlatformDetectionRow,
  basePack: PlatformRulePackRow | null
): string | null {
  const changelogRecord = toRecord(proposal.changelog);
  const candidates: unknown[] = [
    changelogRecord?.summary,
    changelogRecord?.notes,
    proposal.review_notes,
    detection.notes,
    basePack?.summary
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export { SOURCE_POLLERS, buildFingerprint };
