import { NextResponse } from "next/server";
import { callAdminRpc, jsonError, resolveAdminContext } from "./_utils";

interface CreateStepTypePayload {
  reason?: string;
  stepType?: Record<string, unknown>;
}

export async function POST(request: Request) {
  const context = await resolveAdminContext();
  if (context instanceof NextResponse) {
    return context;
  }

  let payload: CreateStepTypePayload;
  try {
    payload = (await request.json()) as CreateStepTypePayload;
  } catch (error) {
    return jsonError(400, "Invalid JSON body");
  }

  if (!payload.reason || !payload.reason.trim()) {
    return jsonError(422, "Reason code is required", { validationErrors: ["Reason code is required"] });
  }

  if (!payload.stepType) {
    return jsonError(422, "Step type definition is required");
  }

  try {
    const result = await callAdminRpc<Record<string, unknown>>("admin_create_step_type", {
      reason: payload.reason,
      actor_id: context.userId,
      step_type: payload.stepType,
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
