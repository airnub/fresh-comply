import { describe, expect, it } from "vitest";
import {
  canApproveSecond,
  canEditStep,
  isElevated,
  requireRole,
  requiresSecondApproval,
  type AdminRole,
} from "../rbac";

describe("rbac helpers", () => {
  it("allows permitted roles to edit steps", () => {
    expect(canEditStep({ role: "platform_admin" })).toBe(true);
    expect(canEditStep({ role: "support_agent" })).toBe(true);
  });

  it("blocks disallowed roles from editing steps", () => {
    expect(canEditStep({ role: "compliance_moderator" as AdminRole })).toBe(false);
  });

  it("requires second approval for high-risk actions", () => {
    expect(requiresSecondApproval("cancel_workflow")).toBe(true);
    expect(requiresSecondApproval("delete_record")).toBe(true);
    expect(requiresSecondApproval("other")).toBe(false);
  });

  it("permits elevated roles", () => {
    expect(isElevated({ role: "platform_admin" })).toBe(true);
    expect(isElevated({ role: "support_agent" as AdminRole })).toBe(false);
  });

  it("validates role requirements", () => {
    expect(() => requireRole({ role: "platform_admin" }, ["platform_admin"])).not.toThrow();
    expect(() => requireRole({ role: "support_agent" }, ["platform_admin"])).toThrow();
  });

  it("checks approval capabilities", () => {
    expect(canApproveSecond({ role: "platform_admin" })).toBe(true);
    expect(canApproveSecond({ role: "dpo" })).toBe(true);
    expect(canApproveSecond({ role: "support_agent" })).toBe(false);
  });
});
