import { NextResponse } from "next/server";
import { callAdminRpc, jsonError, resolveAdminContext } from "../../_utils";

interface BindingPayload {
  reason?: string;
  binding?: {
    org_slug?: string;
    alias?: string;
    provider?: string;
    external_id?: string;
  };
}

export async function POST(request: Request, { params }: { params: { stepTypeId: string } }) {
  const context = await resolveAdminContext();
  if (context instanceof NextResponse) {
    return context;
  }

  const stepTypeId = params.stepTypeId;
  if (!stepTypeId) {
    return jsonError(400, "Step type id is required");
  }

  let payload: BindingPayload;
  try {
    payload = (await request.json()) as BindingPayload;
  } catch (error) {
    return jsonError(400, "Invalid JSON body");
  }

  if (!payload.reason || !payload.reason.trim()) {
    return jsonError(422, "Reason code is required", { validationErrors: ["Reason code is required"] });
  }

  const binding = payload.binding ?? {};
  if (!binding.org_slug || !binding.alias || !binding.provider || !binding.external_id) {
    return jsonError(422, "Binding org, alias, provider, and reference are required");
  }

  const tenantOrgId = context.tenantOrgId ?? context.actorOrgId;
  const actorOrgId = context.actorOrgId ?? context.tenantOrgId;

  if (!tenantOrgId || !actorOrgId) {
    return jsonError(403, "Tenant context unavailable");
  }

  try {
    const result = await callAdminRpc<Record<string, unknown>>("admin_bind_tenant_secret_alias", {
      reason: payload.reason,
      actor_id: context.userId,
      step_type_id: stepTypeId,
      org_slug: binding.org_slug,
      alias: binding.alias,
      provider: binding.provider,
      external_id: binding.external_id,
      org_id: tenantOrgId,
      actor_org_id: actorOrgId,
      on_behalf_of_org_id: context.onBehalfOfOrgId ?? null,
    });

    return NextResponse.json({
      message: "Secret alias bound",
      auditId: result?.audit_id ?? null,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to bind secret alias";
    const details = error instanceof Error && "details" in error ? (error as { details?: string }).details : undefined;
    return jsonError(400, message, details ? { details } : undefined);
  }
}
