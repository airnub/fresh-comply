import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as cancelRun } from "../runs/[runId]/cancel/route";
import { POST as confirmAdminAction } from "../actions/[actionId]/confirm/route";
import { callAdminRpc, resolveAdminContext } from "../_lib";

vi.mock("../_lib", async () => {
  const actual = await vi.importActual<typeof import("../_lib")>("../_lib");
  return {
    ...actual,
    resolveAdminContext: vi.fn(),
    callAdminRpc: vi.fn(),
  };
});

vi.mock("../../../../lib/rbac", () => ({
  requiresSecondApproval: vi.fn().mockReturnValue(true),
}));

const callAdminRpcMock = vi.mocked(callAdminRpc);
const resolveAdminContextMock = vi.mocked(resolveAdminContext);

describe("cancel run handler", () => {
  beforeEach(() => {
    callAdminRpcMock.mockReset();
    resolveAdminContextMock.mockReset();
    callAdminRpcMock.mockResolvedValue({ action_id: "action-123" });
    resolveAdminContextMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000001",
      email: "actor@example.com",
      role: "platform_admin",
      tenantOrgId: "10000000-0000-0000-0000-000000000000",
      actorOrgId: "10000000-0000-0000-0000-000000000000",
      onBehalfOfOrgId: null,
    });
  });

  it("rejects when the second approver matches the actor", async () => {
    const request = new Request("http://localhost/api/admin/runs/run-1/cancel", {
      method: "POST",
      body: JSON.stringify({
        reason: "Testing",
        secondActorId: "00000000-0000-0000-0000-000000000001",
      }),
    });

    const response = await cancelRun(request, { params: { runId: "run-1" } });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Second approver must be a different admin");
    expect(callAdminRpcMock).not.toHaveBeenCalled();
  });

  it("invokes the RPC with the expected payload", async () => {
    const request = new Request("http://localhost/api/admin/runs/run-9/cancel", {
      method: "POST",
      body: JSON.stringify({
        reason: "Need to stop",
        secondActorId: "00000000-0000-0000-0000-000000000002",
      }),
    });

    const response = await cancelRun(request, { params: { runId: "run-9" } });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.actionId).toBe("action-123");
    expect(callAdminRpcMock).toHaveBeenCalledWith("admin_cancel_run", {
      actor_id: "00000000-0000-0000-0000-000000000001",
      run_id: "run-9",
      reason: "Need to stop",
      second_actor_id: "00000000-0000-0000-0000-000000000002",
      tenant_org_id: "10000000-0000-0000-0000-000000000000",
      actor_org_id: "10000000-0000-0000-0000-000000000000",
      on_behalf_of_org_id: null,
    });
  });
});

describe("confirm admin action handler", () => {
  beforeEach(() => {
    callAdminRpcMock.mockReset();
    resolveAdminContextMock.mockReset();

    callAdminRpcMock.mockImplementation(async (procedure, params: Record<string, unknown>) => {
      if (procedure === "rpc_confirm_admin_action") {
        const actorId = (params as { actor_id?: string }).actor_id;
        if (actorId === "00000000-0000-0000-0000-000000000001") {
          throw new Error("Second admin required");
        }
        return {
          admin_action_id: (params as { action_id?: string }).action_id ?? "action-123",
          approved_at: "2025-01-01T00:00:00.000Z",
          audit_id: "audit-456",
        };
      }

      return { action_id: "action-123" };
    });

    resolveAdminContextMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000001",
      email: "actor@example.com",
      role: "platform_admin",
      tenantOrgId: "10000000-0000-0000-0000-000000000000",
      actorOrgId: "10000000-0000-0000-0000-000000000000",
      onBehalfOfOrgId: null,
    });
  });

  it("rejects when the initiating admin tries to confirm", async () => {
    const response = await confirmAdminAction(
      new Request("http://localhost/api/admin/actions/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/confirm", { method: "POST" }),
      { params: { actionId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" } },
    );

    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Second admin required");
    expect(callAdminRpcMock).toHaveBeenCalledWith(
      "rpc_confirm_admin_action",
      expect.objectContaining({
        action_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        actor_id: "00000000-0000-0000-0000-000000000001",
      }),
    );
  });

  it("approves the action when the nominated secondary admin confirms", async () => {
    resolveAdminContextMock.mockResolvedValueOnce({
      userId: "00000000-0000-0000-0000-000000000002",
      email: "second@example.com",
      role: "platform_admin",
      tenantOrgId: "10000000-0000-0000-0000-000000000000",
      actorOrgId: "10000000-0000-0000-0000-000000000000",
      onBehalfOfOrgId: null,
    });

    const response = await confirmAdminAction(
      new Request("http://localhost/api/admin/actions/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/confirm", { method: "POST" }),
      { params: { actionId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" } },
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.actionId).toBe("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    expect(json.approvedAt).toBe("2025-01-01T00:00:00.000Z");
    expect(callAdminRpcMock).toHaveBeenLastCalledWith("rpc_confirm_admin_action", {
      action_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      actor_id: "00000000-0000-0000-0000-000000000002",
      tenant_org_id: "10000000-0000-0000-0000-000000000000",
      actor_org_id: "10000000-0000-0000-0000-000000000000",
      on_behalf_of_org_id: null,
    });
  });
});
