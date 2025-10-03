export type AdminRole =
  | "platform_admin"
  | "support_agent"
  | "compliance_moderator"
  | "dpo";

export interface AdminContext {
  role: AdminRole;
}

const elevatedRoles: AdminRole[] = ["platform_admin"];
const stepEditorRoles: AdminRole[] = ["platform_admin", "support_agent"];
const secondApprovalRoles: AdminRole[] = ["platform_admin", "dpo"];

export function requireRole(context: AdminContext, allowed: AdminRole[]): void {
  if (!allowed.includes(context.role)) {
    throw new Error("Not authorized for this action");
  }
}

export function canEditStep(context: AdminContext): boolean {
  return stepEditorRoles.includes(context.role);
}

export function requiresSecondApproval(action: "cancel_workflow" | "delete_record" | "legal_hold_toggle" | string): boolean {
  if (action === "cancel_workflow" || action === "delete_record" || action === "legal_hold_toggle") {
    return true;
  }
  return false;
}

export function canApproveSecond(context: AdminContext): boolean {
  return secondApprovalRoles.includes(context.role);
}

export function isElevated(context: AdminContext): boolean {
  return elevatedRoles.includes(context.role);
}
