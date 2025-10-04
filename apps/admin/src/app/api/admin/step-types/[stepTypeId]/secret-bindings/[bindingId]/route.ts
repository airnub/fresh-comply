import { NextResponse } from "next/server";
import { callAdminRpc, jsonError, resolveAdminContext } from "../../../_utils";

interface UpdateBindingPayload {
  reason?: string;
  patch?: {
    alias?: string;
    provider?: string;
    external_id?: string;
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: { stepTypeId: string; bindingId: string } }
) {
  const context = await resolveAdminContext();
  if (context instanceof NextResponse) {
    return context;
  }

  const { stepTypeId, bindingId } = params;
  if (!stepTypeId || !bindingId) {
    return jsonError(400, "Step type id and binding id are required");
  }

  let payload: UpdateBindingPayload;
  try {
    payload = (await request.json()) as UpdateBindingPayload;
  } catch (error) {
    return jsonError(400, "Invalid JSON body");
  }

  if (!payload.reason || !payload.reason.trim()) {
    return jsonError(422, "Reason code is required", { validationErrors: ["Reason code is required"] });
  }

  if (!payload.patch) {
    return jsonError(422, "Binding patch payload is required");
  }

  const tenantOrgId = context.tenantOrgId ?? context.actorOrgId;
  const actorOrgId = context.actorOrgId ?? context.tenantOrgId;

  if (!tenantOrgId || !actorOrgId) {
    return jsonError(403, "Tenant context unavailable");
  }

  try {
    const result = await callAdminRpc<Record<string, unknown>>("admin_update_tenant_secret_binding", {
      reason: payload.reason,
      actor_id: context.userId,
      step_type_id: stepTypeId,
      binding_id: bindingId,
      patch: payload.patch,
      org_id: tenantOrgId,
      actor_org_id: actorOrgId,
      on_behalf_of_org_id: context.onBehalfOfOrgId ?? null,
    });

    return NextResponse.json({
      message: "Secret binding updated",
      auditId: result?.audit_id ?? null,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update secret binding";
    const details = error instanceof Error && "details" in error ? (error as { details?: string }).details : undefined;
    return jsonError(400, message, details ? { details } : undefined);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { stepTypeId: string; bindingId: string } }
) {
  const context = await resolveAdminContext();
  if (context instanceof NextResponse) {
    return context;
  }

  const { stepTypeId, bindingId } = params;
  if (!stepTypeId || !bindingId) {
    return jsonError(400, "Step type id and binding id are required");
  }

  let payload: { reason?: string };
  try {
    payload = (await request.json()) as { reason?: string };
  } catch (error) {
    payload = {};
  }

  if (!payload.reason || !payload.reason.trim()) {
    return jsonError(422, "Reason code is required", { validationErrors: ["Reason code is required"] });
  }

  const tenantOrgId = context.tenantOrgId ?? context.actorOrgId;
  const actorOrgId = context.actorOrgId ?? context.tenantOrgId;

  if (!tenantOrgId || !actorOrgId) {
    return jsonError(403, "Tenant context unavailable");
  }

  try {
    const result = await callAdminRpc<Record<string, unknown>>("admin_unbind_tenant_secret_alias", {
      reason: payload.reason,
      actor_id: context.userId,
      step_type_id: stepTypeId,
      binding_id: bindingId,
      org_id: tenantOrgId,
      actor_org_id: actorOrgId,
      on_behalf_of_org_id: context.onBehalfOfOrgId ?? null,
    });

    return NextResponse.json({
      message: "Secret binding removed",
      auditId: result?.audit_id ?? null,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to remove secret binding";
    const details = error instanceof Error && "details" in error ? (error as { details?: string }).details : undefined;
    return jsonError(400, message, details ? { details } : undefined);
  }
}
