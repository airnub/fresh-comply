import type { SupabaseClient } from "@supabase/supabase-js";
import { materialize } from "@airnub/engine/engine";
import type {
  MaterializeContext,
  MaterializeDataSource,
  MaterializedRun,
  OverlayPatch,
  OverlayReference,
  RuleSourceSnapshot,
  RuleVersionRecord,
  RuleVersionSelector,
  TemplateVersionRecord,
  TemplateVersionSelector,
  WorkflowDefinitionVersionRecord,
  WorkflowDSL,
  WorkflowLockfile,
  WorkflowOverlayVersionRecord
} from "@airnub/engine/types";
import type { Database, Json } from "@airnub/types/supabase";

export type CreateWorkflowRunInput = {
  workflowKey: string;
  workflowVersion: string;
  subjectOrgId: string;
  tenantOrgId: string;
  overlays?: OverlayReference[];
  engagerOrgId?: string;
  createdByUserId?: string;
  status?: Database["public"]["Tables"]["workflow_runs"]["Row"]["status"];
  orchestrationProvider?: string;
  orchestrationWorkflowId?: string | null;
};

export type CreateWorkflowRunResult = {
  run: Database["public"]["Tables"]["workflow_runs"]["Row"];
  lockfile: WorkflowLockfile;
  materialized: MaterializedRun;
};

export async function createWorkflowRun(
  client: SupabaseClient<Database>,
  input: CreateWorkflowRunInput,
  context?: MaterializeContext
): Promise<CreateWorkflowRunResult> {
  const overlays = input.overlays ?? [];
  const materializeContext = context ?? createSupabaseMaterializeContext(client, input.tenantOrgId);
  const materialized = await materialize(
    input.workflowKey,
    input.workflowVersion,
    overlays,
    materializeContext
  );

  const insertPayload: Database["public"]["Tables"]["workflow_runs"]["Insert"] = {
    workflow_def_id: materialized.definitionVersion.workflowDefId,
    subject_org_id: input.subjectOrgId,
    tenant_org_id: input.tenantOrgId,
    engager_org_id: input.engagerOrgId ?? null,
    created_by_user_id: input.createdByUserId ?? null,
    status: input.status ?? "active",
    orchestration_provider: input.orchestrationProvider ?? "none",
    orchestration_workflow_id: input.orchestrationWorkflowId ?? null,
    merged_workflow_snapshot: materialized.lockfile as Json
  };

  const { data, error } = await client
    .from("workflow_runs")
    .insert(insertPayload)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to create workflow run: ${error.message}`);
  }
  if (!data) {
    throw new Error("Workflow run insert returned no data");
  }

  return { run: data, lockfile: materialized.lockfile, materialized } satisfies CreateWorkflowRunResult;
}

function createSupabaseMaterializeContext(
  client: SupabaseClient<Database>,
  tenantOrgId: string
): MaterializeContext {
  const dataSource: MaterializeDataSource = {
    async getWorkflowDefinitionVersion(defKey, version) {
      const { data: definition, error: defError } = await client
        .from("workflow_defs")
        .select("id, key")
        .eq("key", defKey)
        .maybeSingle();
      if (defError) {
        throw new Error(`Unable to load workflow definition ${defKey}: ${defError.message}`);
      }
      if (!definition) {
        return undefined;
      }

      const { data: versionRow, error: versionError } = await client
        .from("workflow_def_versions")
        .select("id, workflow_def_id, version, checksum, graph_jsonb, rule_ranges, template_ranges")
        .eq("workflow_def_id", definition.id)
        .eq("version", version)
        .eq("tenant_org_id", tenantOrgId)
        .maybeSingle();

      if (versionError) {
        throw new Error(`Unable to load workflow definition version ${defKey}@${version}: ${versionError.message}`);
      }
      if (!versionRow) {
        return undefined;
      }

      return {
        id: versionRow.id,
        workflowDefId: versionRow.workflow_def_id,
        workflowKey: defKey,
        version: versionRow.version,
        checksum: versionRow.checksum,
        graph: versionRow.graph_jsonb as WorkflowDSL,
        ruleBindings: normaliseSelectors(versionRow.rule_ranges) as Record<string, RuleVersionSelector>,
        templateBindings: normaliseSelectors(versionRow.template_ranges) as Record<string, TemplateVersionSelector>
      } satisfies WorkflowDefinitionVersionRecord;
    },
    async getOverlayVersion(ref) {
      const { data: row, error } = await client
        .from("workflow_pack_versions")
        .select("id, pack_id, version, checksum, overlay_jsonb")
        .eq("tenant_org_id", tenantOrgId)
        .eq("pack_id", ref.id)
        .eq("version", ref.version)
        .maybeSingle();
      if (error) {
        throw new Error(`Unable to load overlay ${ref.id}@${ref.version}: ${error.message}`);
      }
      if (!row) {
        return undefined;
      }

      const patch = normaliseOverlayPatch(row.overlay_jsonb, row.pack_id);
      return {
        id: row.id,
        overlayId: row.pack_id,
        version: row.version,
        checksum: row.checksum,
        patch
      } satisfies WorkflowOverlayVersionRecord;
    },
    async getRuleVersion(ruleId, selector) {
      const version = resolveSelectorVersion(ruleId, selector);
      const { data: row, error } = await client
        .from("rule_versions")
        .select("id, rule_id, version, checksum, sources")
        .eq("tenant_org_id", tenantOrgId)
        .eq("rule_id", ruleId)
        .eq("version", version)
        .maybeSingle();
      if (error) {
        throw new Error(`Unable to load rule ${ruleId}@${version}: ${error.message}`);
      }
      if (!row) {
        return undefined;
      }

      return {
        id: row.id,
        ruleId: row.rule_id,
        version: row.version,
        checksum: row.checksum,
        sources: normaliseRuleSources(row.sources)
      } satisfies RuleVersionRecord;
    },
    async getTemplateVersion(templateId, selector) {
      const version = resolveSelectorVersion(templateId, selector);
      const { data: row, error } = await client
        .from("template_versions")
        .select("id, template_id, version, checksum")
        .eq("tenant_org_id", tenantOrgId)
        .eq("template_id", templateId)
        .eq("version", version)
        .maybeSingle();
      if (error) {
        throw new Error(`Unable to load template ${templateId}@${version}: ${error.message}`);
      }
      if (!row) {
        return undefined;
      }
      return {
        id: row.id,
        templateId: row.template_id,
        version: row.version,
        checksum: row.checksum
      } satisfies TemplateVersionRecord;
    }
  } satisfies MaterializeDataSource;

  return { data: dataSource } satisfies MaterializeContext;
}

function normaliseSelectors(value: unknown): Record<string, RuleVersionSelector | TemplateVersionSelector> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.reduce<Record<string, RuleVersionSelector | TemplateVersionSelector>>((acc, [key, raw]) => {
    if (typeof raw === "string") {
      acc[key] = raw;
    } else if (raw && typeof raw === "object") {
      const maybe = raw as { version?: unknown; range?: unknown };
      if (typeof maybe.version === "string") {
        acc[key] = { version: maybe.version };
      } else if (typeof maybe.range === "string") {
        acc[key] = { range: maybe.range };
      }
    }
    return acc;
  }, {});
}

function resolveSelectorVersion(id: string, selector: RuleVersionSelector | TemplateVersionSelector): string {
  if (typeof selector === "string") {
    return selector;
  }
  if (selector && typeof selector === "object" && typeof selector.version === "string") {
    return selector.version;
  }
  throw new Error(`Unsupported version selector for ${id}`);
}

function normaliseOverlayPatch(value: unknown, fallbackSource: string): OverlayPatch {
  if (value && typeof value === "object" && Array.isArray((value as OverlayPatch).operations)) {
    const patch = value as OverlayPatch;
    return {
      operations: patch.operations,
      source: patch.source ?? fallbackSource
    } satisfies OverlayPatch;
  }
  if (Array.isArray(value)) {
    return { operations: value as OverlayPatch["operations"], source: fallbackSource } satisfies OverlayPatch;
  }
  throw new Error("Overlay patch must be an array of operations");
}

function normaliseRuleSources(value: unknown): RuleSourceSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return undefined;
      }
      const record = entry as Record<string, unknown>;
      const sourceKey = record.source_key ?? record.sourceKey;
      const snapshotId = record.snapshot_id ?? record.snapshotId;
      const fingerprint = record.fingerprint ?? record.hash ?? record.content_hash;
      if (typeof sourceKey === "string" && typeof snapshotId === "string" && typeof fingerprint === "string") {
        return {
          sourceKey,
          snapshotId,
          fingerprint
        } satisfies RuleSourceSnapshot;
      }
      return undefined;
    })
    .filter((item): item is RuleSourceSnapshot => Boolean(item));
}
