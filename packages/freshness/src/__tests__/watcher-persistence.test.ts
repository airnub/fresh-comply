import { describe, expect, it, vi } from "vitest";
import { pollSource, publishApprovedProposal } from "../watcher.js";
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

    const proposals = getTableRows("platform.rule_pack_proposals");
    expect(proposals).toHaveLength(1);
    expect(proposals[0].detection_id).toBe(detections[0].id);
    expect(proposals[0].status).toBe("pending");
    expect(proposals[0].proposed_version).toBe(detections[0].proposed_version);

    const detectionSources = getTableRows("platform.rule_pack_detection_sources");
    expect(detectionSources).toHaveLength(1);
    expect(detectionSources[0].rule_source_id).toBe(ruleSourceId);
    const changeSummary = detectionSources[0].change_summary as Record<string, any>;
    expect(changeSummary.sourceKey).toBe("cro_open_services");
    expect(changeSummary.snapshots?.current?.snapshotId).toBe(event?.current.snapshotId);
    expect(changeSummary.workflows).toEqual(["setup-nonprofit-ie"]);
  });

  it("publishes approved proposals", async () => {
    const detectionId = "00000000-0000-0000-0000-000000000777";
    const proposalId = "00000000-0000-0000-0000-000000000888";
    const basePackId = "00000000-0000-0000-0000-000000000999";

    const { client, getTableRows } = createInMemorySupabase({
      "platform.rule_packs": [
        {
          id: basePackId,
          pack_key: "platform.ie.rules",
          version: "1.0.0",
          title: "IE Compliance Pack",
          summary: "Initial pack",
          manifest: {},
          checksum: "sha-base",
          status: "published",
          created_at: new Date().toISOString()
        }
      ],
      "platform.rule_pack_detections": [
        {
          id: detectionId,
          rule_pack_id: basePackId,
          rule_pack_key: "platform.ie.rules",
          current_version: "1.0.0",
          proposed_version: "1.1.0",
          severity: "minor",
          status: "in_review",
          diff: { summary: "Change" },
          detected_at: new Date().toISOString(),
          notes: "Watcher summary"
        }
      ],
      "platform.rule_pack_proposals": [
        {
          id: proposalId,
          detection_id: detectionId,
          rule_pack_id: basePackId,
          rule_pack_key: "platform.ie.rules",
          current_version: "1.0.0",
          proposed_version: "1.1.0",
          changelog: { summary: "Change" },
          status: "approved",
          review_notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]
    });

    const detection = await publishApprovedProposal(client.schema("platform"), {
      proposalId,
      reviewNotes: "Ship it"
    });

    expect(detection).not.toBeNull();
    expect(detection?.status).toBe("approved");
    expect(detection?.notes).toBe("Ship it");

    const proposals = getTableRows("platform.rule_pack_proposals");
    expect(proposals[0].status).toBe("published");
    expect(proposals[0].review_notes).toBe("Ship it");
    expect(proposals[0].published_at).toBeTruthy();
    expect(proposals[0].rule_pack_id).not.toBeNull();

    const packs = getTableRows("platform.rule_packs");
    const published = packs.find((pack) => pack.version === "1.1.0");
    expect(published).toBeTruthy();
    expect(published?.status).toBe("published");
    expect(typeof published?.checksum).toBe("string");
  });
});
