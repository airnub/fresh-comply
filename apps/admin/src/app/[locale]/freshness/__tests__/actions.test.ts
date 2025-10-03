import { beforeEach, describe, expect, it, vi } from "vitest";
import { approvePendingUpdate, rejectPendingUpdate } from "../actions.js";
import { createInMemorySupabase } from "@airnub/freshness/testing";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

vi.mock("../../../../lib/auth/supabase-ssr", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/auth/supabase-ssr")>(
    "../../../../lib/auth/supabase-ssr"
  );
  return {
    ...actual,
    getSupabaseClient: vi.fn(),
    getSupabaseUser: vi.fn()
  };
});

const { getSupabaseClient, getSupabaseUser } = await import("../../../../lib/auth/supabase-ssr");
const { revalidatePath } = await import("next/cache");

const TENANT_ID = "00000000-0000-0000-0000-000000000555";
const USER_ID = "00000000-0000-0000-0000-000000000777";
const SOURCE_ID = "00000000-0000-0000-0000-000000000999";
const SNAPSHOT_ID = "00000000-0000-0000-0000-000000000888";

function buildProposal() {
  return {
    kind: "source_change" as const,
    sourceKey: "cro_open_services",
    severity: "minor",
    summary: "1 added",
    detectedAt: "2025-01-01T00:00:00Z",
    workflows: ["setup-nonprofit-ie"],
    diff: { added: [], removed: [], changed: [] },
    current: { snapshotId: SNAPSHOT_ID, fingerprint: "hash-current" },
    previous: { snapshotId: "prev", fingerprint: "hash-prev" }
  };
}

function seedSupabase() {
  const { client, getTableRows } = createInMemorySupabase({
    moderation_queue: [
      {
        id: "moderation-1",
        tenant_org_id: TENANT_ID,
        status: "pending",
        proposal: buildProposal(),
        reviewer_id: null,
        decided_at: null,
        created_by: USER_ID,
        notes_md: null
      }
    ],
    workflow_defs: [
      {
        id: "workflow-def-1",
        key: "setup-nonprofit-ie",
        version: "1.2.3",
        title: "Workflow",
        dsl_json: {},
        created_at: new Date().toISOString()
      }
    ],
    source_snapshot: [
      {
        id: SNAPSHOT_ID,
        tenant_org_id: TENANT_ID,
        source_id: SOURCE_ID,
        content_hash: "hash-current",
        parsed_facts: { records: [] },
        storage_ref: null,
        fetched_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }
    ]
  });
  (getSupabaseClient as unknown as vi.Mock).mockReturnValue(client);
  (getSupabaseUser as unknown as vi.Mock).mockResolvedValue({
    id: USER_ID,
    app_metadata: { tenant_org_id: TENANT_ID },
    user_metadata: {}
  });
  return { client, getTableRows };
}

describe("freshness moderation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("approves a moderation item, bumps workflows, and revalidates", async () => {
    const { getTableRows } = seedSupabase();

    const result = await approvePendingUpdate("moderation-1", "Looks good");

    expect(result.ok).toBe(true);
    const [row] = getTableRows("moderation_queue");
    expect(row.status).toBe("approved");
    expect(row.notes_md).toBe("Looks good");
    expect(row.reviewer_id).toBe(USER_ID);
    expect(row.decided_at).toBeTruthy();

    const [workflow] = getTableRows("workflow_defs");
    expect(workflow.version).toBe("1.2.4");

    expect((revalidatePath as vi.Mock)).toHaveBeenCalledWith("/", "layout");
  });

  it("rejects a moderation item without bumping workflows", async () => {
    const { getTableRows } = seedSupabase();

    const result = await rejectPendingUpdate("moderation-1", "Not ready");

    expect(result.ok).toBe(true);
    const [row] = getTableRows("moderation_queue");
    expect(row.status).toBe("rejected");
    expect(row.notes_md).toBe("Not ready");
    expect(row.reviewer_id).toBe(USER_ID);
    expect(row.decided_at).toBeTruthy();

    const [workflow] = getTableRows("workflow_defs");
    expect(workflow.version).toBe("1.2.3");

    expect((revalidatePath as vi.Mock)).toHaveBeenCalledWith("/", "layout");
  });
});
