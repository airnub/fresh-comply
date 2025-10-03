import { NextResponse } from "next/server";
import { z } from "zod";
import { callAdminRpc, jsonError, parseJsonBody, resolveAdminContext } from "../_lib";

const createStepTypeSchema = z.object({
  reason: z.string().min(1, "Reason code is required"),
  stepType: z.record(z.any(), { invalid_type_error: "Step type definition is required" }),
});

export async function POST(request: Request) {
  const context = await resolveAdminContext(["platform_admin"]);
  if (context instanceof NextResponse) {
    return context;
  }

  const parsed = await parseJsonBody(request, createStepTypeSchema);
  if (parsed instanceof NextResponse) {
    return parsed;
  }

  const tenantOrgId = context.tenantOrgId ?? context.actorOrgId;
  const actorOrgId = context.actorOrgId ?? context.tenantOrgId;

  if (!tenantOrgId || !actorOrgId) {
    return jsonError(403, "Tenant context unavailable");
  }

  try {
    const result = await callAdminRpc<Record<string, unknown>>("admin_create_step_type", {
      reason: parsed.reason,
      actor_id: context.userId,
      step_type: parsed.stepType,
      tenant_org_id: tenantOrgId,
      actor_org_id: actorOrgId,
      on_behalf_of_org_id: context.onBehalfOfOrgId ?? null,
    });

    return NextResponse.json({
      message: "Step type draft created",
      auditId: result?.audit_id ?? null,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create step type";
    const details = error instanceof Error && "details" in error ? (error as { details?: string }).details : undefined;
    return jsonError(400, message, details ? { details } : undefined);
  }
}
