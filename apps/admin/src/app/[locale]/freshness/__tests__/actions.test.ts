import { beforeEach, describe, expect, it, vi } from "vitest";
import { approvePendingUpdate, rejectPendingUpdate } from "../actions.js";
import { createInMemorySupabase } from "@airnub/freshness/testing";
import type { Database } from "@airnub/types";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("../../../../lib/auth/supabase-ssr", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/auth/supabase-ssr")>(
    "../../../../lib/auth/supabase-ssr"
  );
  return {
    ...actual,
    getSupabaseClient: vi.fn(),
    getSupabaseUser: vi.fn(),
  };
});

vi.mock("../../../../lib/auth/supabase-service-role", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/auth/supabase-service-role")>(
    "../../../../lib/auth/supabase-service-role"
  );
  return {
    ...actual,
    getSupabaseServiceRoleClient: vi.fn(),
  };
});

vi.mock("@airnub/freshness/watcher", () => ({
  publishApprovedProposal: vi.fn(),
}));

const { getSupabaseClient, getSupabaseUser } = await import("../../../../lib/auth/supabase-ssr");
const { getSupabaseServiceRoleClient } = await import("../../../../lib/auth/supabase-service-role");
const { revalidatePath } = await import("next/cache");
const { publishApprovedProposal } = await import("@airnub/freshness/watcher");

type PlatformDetection = Database["platform"]["Tables"]["rule_pack_detections"]["Row"];

const TENANT_ID = "00000000-0000-0000-0000-000000000555";
const USER_ID = "00000000-0000-0000-0000-000000000777";

function createServiceStub(options: { detectionId?: string } = {}) {
  const detectionId = options.detectionId ?? null;
  const proposalsMaybeSingle = vi.fn().mockResolvedValue({
    data: detectionId ? { detection_id: detectionId } : null,
    error: null,
  });
  const proposalsSelect = vi.fn().mockReturnValue({ maybeSingle: proposalsMaybeSingle });
  const proposalsEq = vi.fn().mockReturnValue({ select: proposalsSelect });
  const proposalsUpdate = vi.fn().mockReturnValue({ eq: proposalsEq });

  const detectionsEq = vi.fn().mockReturnValue({});
  const detectionsUpdate = vi.fn().mockReturnValue({ eq: detectionsEq });

  const from = vi.fn((table: string) => {
    if (table === "rule_pack_proposals") {
      return { update: proposalsUpdate };
    }
    if (table === "rule_pack_detections") {
      return { update: detectionsUpdate };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  const schema = vi.fn().mockReturnValue({ from });

  return {
    schema,
    from,
    proposalsUpdate,
    proposalsEq,
    proposalsSelect,
    proposalsMaybeSingle,
    detectionsUpdate,
    detectionsEq,
  };
}

function seedSupabase() {
  const { client, getTableRows } = createInMemorySupabase({
    workflow_defs: [
      {
        id: "workflow-def-1",
        org_id: TENANT_ID,
        key: "setup-nonprofit-ie",
        version: "1.2.3",
        title: "Workflow",
        dsl_json: {},
        created_at: new Date().toISOString(),
      },
    ],
    funding_opportunities: [
      {
        id: "funding-1",
        org_id: TENANT_ID,
        snapshot_fingerprint: "hash-current",
        title: "Grant",
        url: "https://example.test/grant",
        deadline: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ],
    funding_opportunity_workflows: [],
  });

  (client as unknown as { rpc?: vi.Mock }).rpc = vi.fn().mockResolvedValue({ data: null, error: null });

  (getSupabaseClient as unknown as vi.Mock).mockReturnValue(client);
  (getSupabaseUser as unknown as vi.Mock).mockResolvedValue({
    id: USER_ID,
    app_metadata: { tenant_org_id: TENANT_ID },
    user_metadata: {},
  });

  return { client, getTableRows };
}

describe("freshness moderation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (publishApprovedProposal as vi.Mock).mockReset();
  });

  it("approves a detection, bumps workflows, and revalidates", async () => {
    const { client, getTableRows } = seedSupabase();
    const detection: Partial<PlatformDetection> = {
      id: "detection-1",
      rule_pack_key: "funding_radar",
      diff: {
        workflows: ["setup-nonprofit-ie"],
        snapshotFingerprint: "hash-current",
      } as unknown,
      proposed_version: "1.2.4",
      current_version: "1.2.3",
      severity: "minor",
    };
    const service = createServiceStub({ detectionId: detection.id });
    (getSupabaseServiceRoleClient as unknown as vi.Mock).mockReturnValue(service);
    (publishApprovedProposal as vi.Mock).mockResolvedValue(detection as PlatformDetection);

    const result = await approvePendingUpdate("proposal-1", "Looks good");

    expect(result.ok).toBe(true);
    const [workflow] = getTableRows("workflow_defs");
    expect(workflow.version).toBe("1.2.4");

    const links = getTableRows("funding_opportunity_workflows");
    expect(links).toHaveLength(1);
    expect(links[0]?.workflow_key).toBe("setup-nonprofit-ie");

    expect(service.proposalsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "approved", review_notes: "Looks good" })
    );
    expect(service.proposalsEq).toHaveBeenCalledWith("id", "proposal-1");
    expect(publishApprovedProposal).toHaveBeenCalledWith(expect.anything(), {
      proposalId: "proposal-1",
      reviewNotes: "Looks good",
    });
    expect((client as unknown as { rpc: vi.Mock }).rpc).toHaveBeenCalledWith(
      "admin_approve_freshness_diff",
      expect.objectContaining({ diff_id: "detection-1", reason: "Looks good" })
    );
    expect((revalidatePath as vi.Mock)).toHaveBeenCalledWith("/", "layout");
  });

  it("rejects a detection and appends audit", async () => {
    const { client } = seedSupabase();
    const detection: Partial<PlatformDetection> = {
      id: "detection-2",
      rule_pack_key: "cro_open_services",
      diff: {} as unknown,
    };
    const service = createServiceStub({ detectionId: detection.id });
    (getSupabaseServiceRoleClient as unknown as vi.Mock).mockReturnValue(service);
    (publishApprovedProposal as vi.Mock).mockResolvedValue(null);

    const result = await rejectPendingUpdate("proposal-2", "Not ready");

    expect(result.ok).toBe(true);
    expect(service.proposalsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rejected", review_notes: "Not ready" })
    );
    expect(service.detectionsUpdate).toHaveBeenCalledWith({ status: "rejected", notes: "Not ready" });
    expect(service.proposalsEq).toHaveBeenCalledWith("id", "proposal-2");
    expect(service.detectionsEq).toHaveBeenCalledWith("id", "detection-2");
    expect(publishApprovedProposal).not.toHaveBeenCalled();
    expect((client as unknown as { rpc: vi.Mock }).rpc).toHaveBeenCalledWith(
      "admin_reject_freshness_diff",
      expect.objectContaining({ diff_id: "detection-2", reason: "Not ready" })
    );
    expect((revalidatePath as vi.Mock)).toHaveBeenCalledWith("/", "layout");
  });
});
