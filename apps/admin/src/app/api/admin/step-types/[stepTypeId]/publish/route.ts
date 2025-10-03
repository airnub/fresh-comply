import { NextResponse } from "next/server";
import { callAdminRpc, jsonError, resolveAdminContext } from "../../_utils";

interface PublishPayload {
  reason?: string;
  version?: string;
  changelog?: string;
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

  let payload: PublishPayload;
  try {
    payload = (await request.json()) as PublishPayload;
  } catch (error) {
    return jsonError(400, "Invalid JSON body");
  }

  if (!payload.reason || !payload.reason.trim()) {
    return jsonError(422, "Reason code is required", { validationErrors: ["Reason code is required"] });
  }

  if (!payload.version) {
    return jsonError(422, "Version identifier is required");
  }

  try {
    const result = await callAdminRpc<Record<string, unknown>>("admin_publish_step_type_version", {
      reason: payload.reason,
      actor_id: context.userId,
      step_type_id: stepTypeId,
      version_id: payload.version,
      changelog: payload.changelog ?? null,
    });

    return NextResponse.json({
      message: "Step type version published",
      auditId: result?.audit_id ?? null,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to publish version";
    const details = error instanceof Error && "details" in error ? (error as { details?: string }).details : undefined;
    return jsonError(400, message, details ? { details } : undefined);
  }
}
