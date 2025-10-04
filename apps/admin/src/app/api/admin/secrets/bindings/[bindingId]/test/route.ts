import { NextResponse } from "next/server";
import { z } from "zod";
import { callAdminRpc, parseJsonBody, resolveAdminContext } from "../../../../../_lib";

const schema = z.object({
  reason: z.string().min(1, "Reason code is required"),
});

export async function POST(request: Request, { params }: { params: { bindingId: string } }) {
  const context = await resolveAdminContext(["platform_admin", "support_agent"]);
  if (context instanceof NextResponse) {
    return context;
  }

  const parsed = await parseJsonBody(request, schema);
  if (parsed instanceof NextResponse) {
    return parsed;
  }

  const tenantOrgId = context.tenantOrgId ?? context.actorOrgId;
  const actorOrgId = context.actorOrgId ?? context.tenantOrgId;

  if (!tenantOrgId || !actorOrgId) {
    return NextResponse.json({ error: "Tenant context unavailable" }, { status: 403 });
  }

  try {
    const result = await callAdminRpc<Record<string, unknown>>("admin_test_secret_alias", {
      actor_id: context.userId,
      binding_id: params.bindingId,
      reason: parsed.reason,
      org_id: tenantOrgId,
      actor_org_id: actorOrgId,
      on_behalf_of_org_id: context.onBehalfOfOrgId ?? null,
    });

    return NextResponse.json({
      message: "Secret alias test executed",
      actionId: result?.action_id ?? null,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to test secret alias";
    const details = error instanceof Error && "details" in error ? (error as { details?: string }).details : undefined;
    return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status: 400 });
  }
}
