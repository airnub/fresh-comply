import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as cancelRun } from "../runs/[runId]/cancel/route";
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
    callAdminRpcMock.mockClear();
    resolveAdminContextMock.mockClear();
    callAdminRpcMock.mockResolvedValue({ action_id: "action-123" });
    resolveAdminContextMock.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000001",
      email: "actor@example.com",
      role: "platform_admin",
    });
  });

  it("rejects when the second approver matches the actor", async () => {
    const request = new Request("http://localhost/api/admin/runs/run-1/cancel", {
      method: "POST",
      body: JSON.stringify({
        reason: "Testing",
        approvedBy: "00000000-0000-0000-0000-000000000001",
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
        approvedBy: "00000000-0000-0000-0000-000000000002",
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
    });
  });
});
