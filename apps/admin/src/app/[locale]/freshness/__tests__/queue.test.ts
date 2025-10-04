import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPendingFreshnessUpdates } from "../../../../server/freshness.js";
import type { Database } from "@airnub/types";

vi.mock("../../../../lib/auth/supabase-service-role", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/auth/supabase-service-role")>(
    "../../../../lib/auth/supabase-service-role"
  );
  return {
    ...actual,
    getSupabaseServiceRoleClient: vi.fn(),
  };
});

const { getSupabaseServiceRoleClient, SupabaseServiceRoleConfigurationError } = await import(
  "../../../../lib/auth/supabase-service-role"
);

type PlatformDetection = Database["platform"]["Tables"]["rule_pack_detections"]["Row"];
type PlatformDetectionSource = Database["platform"]["Tables"]["rule_pack_detection_sources"]["Row"];

function createListServiceStub(rows: (PlatformDetection & {
  rule_packs?: { title: string | null } | null;
  detection_sources?: (PlatformDetectionSource & {
    rule_source?: { name: string | null } | null;
  })[];
})[]) {
  const order = vi.fn().mockResolvedValue({ data: rows, error: null });
  const filterBuilder = {
    in: vi.fn().mockReturnThis(),
    order,
  };
  const select = vi.fn().mockReturnValue(filterBuilder);
  const from = vi.fn().mockReturnValue({ select });
  const schema = vi.fn().mockReturnValue({ from });
  return { schema, from, select, filterBuilder, order };
}

describe("getPendingFreshnessUpdates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps platform detections into pending updates", async () => {
    const detection = {
      id: "detection-1",
      rule_pack_id: "pack-1",
      rule_pack_key: "cro_open_services",
      current_version: "1.0.0",
      proposed_version: "1.1.0",
      severity: "minor",
      status: "open",
      diff: {
        summary: "One addition",
        workflows: ["setup-nonprofit-ie"],
        current: { fingerprint: "hash-current" },
        previous: { fingerprint: "hash-prev" },
        metadata: { verifiedAt: "2025-01-01T00:00:00Z" },
      } as unknown,
      detected_at: "2025-01-02T00:00:00Z",
      created_by: null,
      notes: "Automated",
      rule_packs: { title: "CRO Pack" },
      detection_sources: [
        {
          detection_id: "detection-1",
          rule_source_id: "source-1",
          change_summary: { added: 1 } as unknown,
          rule_source: { name: "CRO Source" },
        },
      ],
    } satisfies PlatformDetection & {
      rule_packs: { title: string };
      detection_sources: (PlatformDetectionSource & { rule_source: { name: string } })[];
    };

    const service = createListServiceStub([detection]);
    (getSupabaseServiceRoleClient as unknown as vi.Mock).mockReturnValue(service);

    const updates = await getPendingFreshnessUpdates();

    expect(updates).toHaveLength(1);
    const [update] = updates;
    expect(update?.summary).toBe("One addition");
    expect(update?.packTitle).toBe("CRO Pack");
    expect(update?.status).toBe("pending");
    expect(update?.workflows).toEqual(["setup-nonprofit-ie"]);
    expect(update?.proposedVersion).toBe("1.1.0");
    expect(update?.currentVersion).toBe("1.0.0");
    expect(update?.sources).toEqual([
      expect.objectContaining({ id: "source-1", name: "CRO Source" }),
    ]);
  });

  it("falls back to demo data when service role is unavailable", async () => {
    (getSupabaseServiceRoleClient as unknown as vi.Mock).mockImplementation(() => {
      throw new SupabaseServiceRoleConfigurationError("missing env");
    });

    const updates = await getPendingFreshnessUpdates();

    expect(updates).not.toHaveLength(0);
    expect(updates[0]?.sourceKey).toBe("cro_open_services");
  });
});
