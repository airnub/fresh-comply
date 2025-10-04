import { describe, expect, it, vi } from "vitest";
import { pollSource } from "../watcher.js";
import { SOURCES } from "../sources.js";
import { createInMemorySupabase } from "../testing/inMemorySupabase.js";

vi.mock("@airnub/connectors/cro", () => ({
  lookupCompanyByName: vi.fn(async () => ({
    records: [
      { id: "company-1", name: "Fresh Example CLG" },
      { id: "company-2", name: "Fresh Example Foundation" }
    ],
    resourceId: "cro-resource",
    total: 2,
    issuedAt: "2025-01-01T00:00:00Z"
  }))
}));

vi.mock("@airnub/connectors/charities", () => ({
  fetchCharitiesDataset: vi.fn(async () => ({
    records: [],
    resourceId: "charities-resource",
    total: 0,
    issuedAt: "2025-01-01T00:00:00Z"
  }))
}));

vi.mock("@airnub/connectors/revenue", () => ({
  fetchRevenueCharityRegistrations: vi.fn(async () => ({
    records: [],
    resourceId: "revenue-resource",
    total: 0,
    issuedAt: "2025-01-01T00:00:00Z"
  }))
}));

vi.mock("@airnub/connectors/funding", () => ({
  harvestFundingRadar: vi.fn(async () => ({
    records: [],
    resourceId: "funding-resource",
    total: 0,
    issuedAt: "2025-01-01T00:00:00Z"
  }))
}));

describe("pollSource persistence", () => {
  const ruleSourceId = "00000000-0000-0000-0000-000000000321";
  const rulePackId = "00000000-0000-0000-0000-000000000654";

  it("persists platform snapshots and detections", async () => {
    const { client, getTableRows } = createInMemorySupabase({
      "platform.rule_sources": [
        {
          id: ruleSourceId,
          name: SOURCES.cro_open_services.label,
          url: SOURCES.cro_open_services.url,
          parser: "cro_open_services",
          jurisdiction: SOURCES.cro_open_services.jurisdiction,
          category: SOURCES.cro_open_services.category,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ],
      "platform.rule_packs": [
        {
          id: rulePackId,
          pack_key: "platform.ie.rules",
          version: "1.0.0",
          title: "IE Compliance Pack",
          summary: "Initial pack",
          manifest: {},
          checksum: "sha-1",
          status: "published",
          created_at: new Date().toISOString()
        }
      ]
    });

    const event = await pollSource("cro_open_services", {
      supabase: client,
      workflows: ["setup-nonprofit-ie"],
      ruleSourceId,
      rulePack: {
        id: rulePackId,
        key: "platform.ie.rules",
        currentVersion: "1.0.0"
      }
    });

    expect(event).not.toBeNull();
    expect(event?.current.snapshotId).toBeTruthy();

    const snapshots = getTableRows("platform.rule_source_snapshots");
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].rule_source_id).toBe(ruleSourceId);
    expect(snapshots[0].content_hash).toBe(event?.current.fingerprint);

    const detections = getTableRows("platform.rule_pack_detections");
    expect(detections).toHaveLength(1);
    expect(detections[0].rule_pack_id).toBe(rulePackId);
    expect(detections[0].rule_pack_key).toBe("platform.ie.rules");
    expect(detections[0].severity).toBe("info");
    expect(detections[0].diff?.summary).toBe(event?.summary);

    const detectionSources = getTableRows("platform.rule_pack_detection_sources");
    expect(detectionSources).toHaveLength(1);
    expect(detectionSources[0].rule_source_id).toBe(ruleSourceId);
    const changeSummary = detectionSources[0].change_summary as Record<string, any>;
    expect(changeSummary.sourceKey).toBe("cro_open_services");
    expect(changeSummary.snapshots?.current?.snapshotId).toBe(event?.current.snapshotId);
    expect(changeSummary.workflows).toEqual(["setup-nonprofit-ie"]);
  });
});
