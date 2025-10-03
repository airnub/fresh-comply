import { beforeEach, describe, expect, it, vi } from "vitest";
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
  const tenantOrgId = "00000000-0000-0000-0000-000000000123";
  const sourceRegistryId = "00000000-0000-0000-0000-000000000321";

  beforeEach(() => {
    process.env.FRESHNESS_TENANT_ORG_ID = tenantOrgId;
  });

  it("persists snapshots, change events, and moderation proposals", async () => {
    const { client, getTableRows } = createInMemorySupabase({
      source_registry: [
        {
          id: sourceRegistryId,
          tenant_org_id: tenantOrgId,
          name: SOURCES.cro_open_services.label,
          url: SOURCES.cro_open_services.url,
          parser: "cro_open_services",
          jurisdiction: SOURCES.cro_open_services.jurisdiction,
          category: SOURCES.cro_open_services.category,
          created_at: new Date().toISOString()
        }
      ]
    });

    const event = await pollSource("cro_open_services", {
      supabase: client,
      tenantOrgId,
      workflows: ["setup-nonprofit-ie"]
    });

    expect(event).not.toBeNull();
    expect(event?.current.snapshotId).toBeTruthy();

    const snapshots = getTableRows("source_snapshot");
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].tenant_org_id).toBe(tenantOrgId);
    expect(snapshots[0].source_id).toBe(sourceRegistryId);
    expect(snapshots[0].content_hash).toBe(event?.current.fingerprint);

    const changeEvents = getTableRows("change_event");
    expect(changeEvents).toHaveLength(1);
    expect(changeEvents[0].tenant_org_id).toBe(tenantOrgId);
    expect(changeEvents[0].source_id).toBe(sourceRegistryId);
    expect(changeEvents[0].to_hash).toBe(event?.current.fingerprint);

    const queue = getTableRows("moderation_queue");
    expect(queue).toHaveLength(1);
    const proposal = queue[0].proposal as Record<string, any>;
    expect(proposal).toBeTruthy();
    expect(proposal.kind).toBe("source_change");
    expect(proposal.sourceKey).toBe("cro_open_services");
    expect(proposal.current?.snapshotId).toBe(event?.current.snapshotId);
    expect(proposal.workflows).toEqual(["setup-nonprofit-ie"]);
    expect(proposal.diff?.added?.length).toBeGreaterThan(0);
  });
});
