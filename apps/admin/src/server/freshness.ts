import type { SourceDiff } from "@airnub/freshness/watcher";
import { SOURCE_POLLERS } from "@airnub/freshness/watcher";
import { getSupabaseClient, SupabaseConfigurationError } from "../lib/auth/supabase-ssr";
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
};

type SourceModerationProposal = {
  kind: "source_change";
  sourceKey: string;
  severity?: string;
  summary: string;
  detectedAt: string;
  workflows?: string[];
  diff?: SourceDiff;
  current?: unknown;
  previous?: unknown;
};

function parseProposal(value: Json | null): SourceModerationProposal | null {
  if (!value || typeof value !== "object") return null;
  const proposal = value as SourceModerationProposal;
  if (proposal.kind !== "source_change") return null;
  return proposal;
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
      severity: "minor",
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
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("moderation_queue")
      .select("id, status, proposal, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    if (!data?.length) {
      return [];
    }

    return data.map((row) => {
      const proposal = parseProposal(row.proposal);
      const diff = proposal?.diff ?? { added: [], removed: [], changed: [] };
      const workflows = Array.isArray(proposal?.workflows) ? proposal?.workflows : [];
      return {
        id: row.id,
        sourceKey: proposal?.sourceKey ?? "unknown",
        summary: proposal?.summary ?? "Pending change",
        detectedAt: proposal?.detectedAt ?? row.created_at ?? new Date().toISOString(),
        status: row.status,
        workflows,
        diff,
        current: proposal?.current ?? null,
        previous: proposal?.previous ?? null,
        severity: proposal?.severity
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
