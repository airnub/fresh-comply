import { NextResponse } from "next/server";
import { z } from "zod";
import { callAdminRpc, parseJsonBody, resolveAdminContext } from "../../../_lib";
import { requiresSecondApproval } from "../../../../../../lib/rbac";

const schema = z.object({
  reason: z.string().min(1, "Reason code is required"),
  enabled: z.boolean(),
  approvedBy: z.string().uuid("Second approver id must be a UUID").optional(),
});

export async function POST(request: Request, { params }: { params: { requestId: string } }) {
  const context = await resolveAdminContext(["platform_admin", "dpo"]);
  if (context instanceof NextResponse) {
    return context;
  }

  const parsed = await parseJsonBody(request, schema);
  if (parsed instanceof NextResponse) {
    return parsed;
  }

  const requiresSecond = requiresSecondApproval("legal_hold_toggle");
  const secondActorId = parsed.approvedBy ?? null;

  if (requiresSecond && !secondActorId) {
    return NextResponse.json({ error: "Legal hold changes require a second approver" }, { status: 400 });
  }

  if (secondActorId && secondActorId === context.userId) {
    return NextResponse.json({ error: "Second approver must be another admin" }, { status: 400 });
  }

  try {
    const result = await callAdminRpc<Record<string, unknown>>("admin_toggle_legal_hold", {
      actor_id: context.userId,
      request_id: params.requestId,
      reason: parsed.reason,
      enabled: parsed.enabled,
      second_actor_id: secondActorId,
    });

    return NextResponse.json({
      message: parsed.enabled ? "Legal hold enabled" : "Legal hold disabled",
      actionId: result?.action_id ?? null,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update legal hold";
    const details = error instanceof Error && "details" in error ? (error as { details?: string }).details : undefined;
    return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status: 400 });
  }
}
