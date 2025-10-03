import type { SourceDiff } from "@airnub/freshness/watcher";
import { SOURCE_POLLERS } from "@airnub/freshness/watcher";
import { getSupabaseClient, SupabaseConfigurationError } from "../lib/auth/supabase-ssr";
import type { Database, Json } from "@airnub/types/supabase";

type FreshnessRow = Database["public"]["Tables"]["freshness_pending_updates"]["Row"];

type PendingUpdate = {
  id: string;
  sourceKey: FreshnessRow["source_key"];
  summary: FreshnessRow["diff_summary"];
  detectedAt: string;
  status: FreshnessRow["status"];
  workflows: string[];
  diff: SourceDiff;
  current: unknown;
  previous: unknown;
  verifiedAt?: string | null;
};

function parseDiffPayload(value: Json | null): {
  diff: SourceDiff;
  current: unknown;
  previous: unknown;
} {
  if (!value || typeof value !== "object") {
    return { diff: { added: [], removed: [], changed: [] }, current: null, previous: null };
  }
  const payload = value as Record<string, unknown>;
  return {
    diff: (payload.diff as SourceDiff) ?? { added: [], removed: [], changed: [] },
    current: payload.current,
    previous: payload.previous
  };
}

function buildFallback(): PendingUpdate[] {
  const detectedAt = new Date().toISOString();
  return [
    {
      id: "demo-cro",
      sourceKey: "cro_open_services",
      summary: "1 added · 0 removed · 0 updated · 2 records",
      detectedAt,
      status: "pending",
      workflows: ["setup-nonprofit-ie"],
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
      previous: [],
      verifiedAt: null
    }
  ];
}

export async function getPendingFreshnessUpdates(): Promise<PendingUpdate[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("freshness_pending_updates")
      .select("id, source_key, diff_summary, diff_payload, detected_at, status, workflow_keys, verified_at")
      .order("detected_at", { ascending: false });

    if (error) {
      throw error;
    }

    if (!data?.length) {
      return [];
    }

    return data.map((row) => {
      const payload = parseDiffPayload(row.diff_payload);
      return {
        id: row.id,
        sourceKey: row.source_key,
        summary: row.diff_summary,
        detectedAt: row.detected_at,
        status: row.status,
        workflows: row.workflow_keys ?? [],
        diff: payload.diff,
        current: payload.current,
        previous: payload.previous,
        verifiedAt: row.verified_at
      } satisfies PendingUpdate;
    });
  } catch (error) {
    if (!(error instanceof SupabaseConfigurationError)) {
      console.warn("Unable to fetch freshness updates", error);
    }
    return buildFallback();
  }
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
