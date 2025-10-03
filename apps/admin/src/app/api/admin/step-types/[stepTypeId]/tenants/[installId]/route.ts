import { NextResponse } from "next/server";
import { callAdminRpc, jsonError, resolveAdminContext } from "../../../_utils";

interface UpdateInstallPayload {
  reason?: string;
  patch?: {
    follow_latest?: boolean;
    version_id?: string | null;
    status?: string;
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: { stepTypeId: string; installId: string } }
) {
  const context = await resolveAdminContext();
  if (context instanceof NextResponse) {
    return context;
  }

  const stepTypeId = params.stepTypeId;
  const installId = params.installId;

  if (!stepTypeId || !installId) {
    return jsonError(400, "Step type id and install id are required");
  }

  let payload: UpdateInstallPayload;
  try {
    payload = (await request.json()) as UpdateInstallPayload;
  } catch (error) {
    return jsonError(400, "Invalid JSON body");
  }

  if (!payload.reason || !payload.reason.trim()) {
    return jsonError(422, "Reason code is required", { validationErrors: ["Reason code is required"] });
  }

  if (!payload.patch) {
    return jsonError(422, "Install patch payload is required");
  }

  try {
    const result = await callAdminRpc<Record<string, unknown>>("admin_update_tenant_step_type_install", {
      reason: payload.reason,
      actor_id: context.userId,
      step_type_id: stepTypeId,
      install_id: installId,
      patch: payload.patch,
    });

    return NextResponse.json({
      message: "Tenant install updated",
      auditId: result?.audit_id ?? null,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update tenant install";
    const details = error instanceof Error && "details" in error ? (error as { details?: string }).details : undefined;
    return jsonError(400, message, details ? { details } : undefined);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { stepTypeId: string; installId: string } }
) {
  const context = await resolveAdminContext();
  if (context instanceof NextResponse) {
    return context;
  }

  const stepTypeId = params.stepTypeId;
  const installId = params.installId;

  if (!stepTypeId || !installId) {
    return jsonError(400, "Step type id and install id are required");
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

  try {
    const result = await callAdminRpc<Record<string, unknown>>("admin_disable_tenant_step_type", {
      reason: payload.reason,
      actor_id: context.userId,
      step_type_id: stepTypeId,
      install_id: installId,
    });

    return NextResponse.json({
      message: "Tenant install disabled",
      auditId: result?.audit_id ?? null,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to disable tenant install";
    const details = error instanceof Error && "details" in error ? (error as { details?: string }).details : undefined;
    return jsonError(400, message, details ? { details } : undefined);
  }
}
