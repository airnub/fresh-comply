import { NextResponse } from "next/server";
import { z } from "zod";
import { callAdminRpc, resolveAdminContext } from "../../../_lib";

const paramsSchema = z.object({
  actionId: z.string().uuid("Action id must be a UUID"),
});

type ConfirmResult = {
  admin_action_id?: string;
  approved_at?: string;
  audit_id?: string;
};

export async function POST(_request: Request, { params }: { params: { actionId: string } }) {
  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid admin action id" }, { status: 400 });
  }

  const context = await resolveAdminContext(["platform_admin", "support_agent", "dpo"]);
  if (context instanceof NextResponse) {
    return context;
  }

  const tenantOrgId = context.tenantOrgId ?? context.actorOrgId;
  const actorOrgId = context.actorOrgId ?? context.tenantOrgId;

  if (!tenantOrgId || !actorOrgId) {
    return NextResponse.json({ error: "Tenant context unavailable" }, { status: 403 });
  }

  try {
    const result = await callAdminRpc<ConfirmResult>("rpc_confirm_admin_action", {
      action_id: parsedParams.data.actionId,
      actor_id: context.userId,
      org_id: tenantOrgId,
      actor_org_id: actorOrgId,
      on_behalf_of_org_id: context.onBehalfOfOrgId ?? null,
    });

    return NextResponse.json({
      message: "Admin action approved",
      actionId: result.admin_action_id ?? parsedParams.data.actionId,
      approvedAt: result.approved_at ?? null,
      auditId: result.audit_id ?? null,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to approve admin action";
    const details = error instanceof Error && "details" in error ? (error as { details?: string }).details : undefined;
    return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status: 400 });
  }
}
