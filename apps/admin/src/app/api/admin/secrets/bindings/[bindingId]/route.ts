import { NextResponse } from "next/server";
import { z } from "zod";
import { callAdminRpc, parseJsonBody, resolveAdminContext } from "../../../../_lib";

const updateSchema = z.object({
  reason: z.string().min(1, "Reason code is required"),
  description: z.string().optional(),
  externalId: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: { bindingId: string } }) {
  const context = await resolveAdminContext(["platform_admin", "support_agent"]);
  if (context instanceof NextResponse) {
    return context;
  }

  const parsed = await parseJsonBody(request, updateSchema);
  if (parsed instanceof NextResponse) {
    return parsed;
  }

  const tenantOrgId = context.tenantOrgId ?? context.actorOrgId;
  const actorOrgId = context.actorOrgId ?? context.tenantOrgId;

  if (!tenantOrgId || !actorOrgId) {
    return NextResponse.json({ error: "Tenant context unavailable" }, { status: 403 });
  }

  try {
    const result = await callAdminRpc<Record<string, unknown>>("admin_update_secret_alias", {
      actor_id: context.userId,
      binding_id: params.bindingId,
      reason: parsed.reason,
      description: parsed.description ?? null,
      external_id: parsed.externalId ?? null,
      tenant_org_id: tenantOrgId,
      actor_org_id: actorOrgId,
      on_behalf_of_org_id: context.onBehalfOfOrgId ?? null,
    });

    return NextResponse.json({
      message: "Secret alias updated",
      actionId: result?.action_id ?? null,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update secret alias";
    const details = error instanceof Error && "details" in error ? (error as { details?: string }).details : undefined;
    return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status: 400 });
  }
}

const deleteSchema = z.object({
  reason: z.string().min(1, "Reason code is required"),
  approvedBy: z.string().uuid("Second approver id must be a UUID").optional(),
});

export async function DELETE(request: Request, { params }: { params: { bindingId: string } }) {
  const context = await resolveAdminContext(["platform_admin"]);
  if (context instanceof NextResponse) {
    return context;
  }

  const parsed = await parseJsonBody(request, deleteSchema);
  if (parsed instanceof NextResponse) {
    return parsed;
  }

  const secondActorId = parsed.approvedBy ?? null;
  if (secondActorId && secondActorId === context.userId) {
    return NextResponse.json({ error: "Second approver must be another admin" }, { status: 400 });
  }

  const tenantOrgId = context.tenantOrgId ?? context.actorOrgId;
  const actorOrgId = context.actorOrgId ?? context.tenantOrgId;

  if (!tenantOrgId || !actorOrgId) {
    return NextResponse.json({ error: "Tenant context unavailable" }, { status: 403 });
  }

  try {
    const result = await callAdminRpc<Record<string, unknown>>("admin_remove_secret_alias", {
      actor_id: context.userId,
      binding_id: params.bindingId,
      reason: parsed.reason,
      second_actor_id: secondActorId,
      tenant_org_id: tenantOrgId,
      actor_org_id: actorOrgId,
      on_behalf_of_org_id: context.onBehalfOfOrgId ?? null,
    });

    return NextResponse.json({
      message: "Secret alias removed",
      actionId: result?.action_id ?? null,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to remove secret alias";
    const details = error instanceof Error && "details" in error ? (error as { details?: string }).details : undefined;
    return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status: 400 });
  }
}
