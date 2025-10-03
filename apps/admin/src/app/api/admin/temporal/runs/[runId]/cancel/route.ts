import { NextResponse } from "next/server";
import { z } from "zod";
import { callAdminRpc, parseJsonBody, resolveAdminContext } from "../../../../_lib";
import { requiresSecondApproval } from "../../../../../../lib/rbac";

const schema = z.object({
  reason: z.string().min(1, "Reason code is required"),
  secondActorId: z.string().uuid("Second approver id must be a UUID"),
});

export async function POST(request: Request, { params }: { params: { runId: string } }) {
  const context = await resolveAdminContext(["platform_admin", "support_agent", "dpo"]);
  if (context instanceof NextResponse) {
    return context;
  }

  const parsed = await parseJsonBody(request, schema);
  if (parsed instanceof NextResponse) {
    return parsed;
  }

  if (parsed.secondActorId === context.userId) {
    return NextResponse.json({ error: "Second approver must be a different admin" }, { status: 400 });
  }

  if (!requiresSecondApproval("cancel_workflow")) {
    return NextResponse.json({ error: "Cancellation does not require second approval" }, { status: 400 });
  }

  const tenantOrgId = context.tenantOrgId ?? context.actorOrgId;
  const actorOrgId = context.actorOrgId ?? context.tenantOrgId;

  if (!tenantOrgId || !actorOrgId) {
    return NextResponse.json({ error: "Tenant context unavailable" }, { status: 403 });
  }

  try {
    const result = await callAdminRpc<Record<string, unknown>>("admin_temporal_cancel", {
      actor_id: context.userId,
      run_id: params.runId,
      reason: parsed.reason,
      second_actor_id: parsed.secondActorId,
      tenant_org_id: tenantOrgId,
      actor_org_id: actorOrgId,
      on_behalf_of_org_id: context.onBehalfOfOrgId ?? null,
    });

    return NextResponse.json({
      message: "Temporal cancellation requested",
      actionId: result?.action_id ?? null,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to cancel Temporal workflow";
    const details = error instanceof Error && "details" in error ? (error as { details?: string }).details : undefined;
    return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status: 400 });
  }
}
