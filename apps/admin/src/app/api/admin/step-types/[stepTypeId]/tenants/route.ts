import { NextResponse } from "next/server";
import { callAdminRpc, jsonError, resolveAdminContext } from "../../_utils";

interface InstallPayload {
  reason?: string;
  install?: {
    org_slug?: string;
    version_id?: string;
    follow_latest?: boolean;
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

  let payload: InstallPayload;
  try {
    payload = (await request.json()) as InstallPayload;
  } catch (error) {
    return jsonError(400, "Invalid JSON body");
  }

  if (!payload.reason || !payload.reason.trim()) {
    return jsonError(422, "Reason code is required", { validationErrors: ["Reason code is required"] });
  }

  const install = payload.install ?? {};
  if (!install.org_slug) {
    return jsonError(422, "Organisation slug is required");
  }

  if (!install.follow_latest && !install.version_id) {
    return jsonError(422, "Version id is required when not following latest");
  }

  try {
    const result = await callAdminRpc<Record<string, unknown>>("admin_enable_tenant_step_type", {
      reason: payload.reason,
      actor_id: context.userId,
      step_type_id: stepTypeId,
      org_slug: install.org_slug,
      version_id: install.version_id ?? null,
      follow_latest: install.follow_latest ?? false,
    });

    return NextResponse.json({
      message: "Tenant step type installed",
      auditId: result?.audit_id ?? null,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to enable tenant";
    const details = error instanceof Error && "details" in error ? (error as { details?: string }).details : undefined;
    return jsonError(400, message, details ? { details } : undefined);
  }
}
