import { NextResponse } from "next/server";
import { z } from "zod";
import { callAdminRpc, parseJsonBody, resolveAdminContext } from "../../_lib";

const schema = z.object({
  reason: z.string().min(1, "Reason code is required"),
  orgId: z.string().uuid("Organisation id must be a UUID"),
  alias: z
    .string()
    .min(3, "Alias must be at least 3 characters")
    .regex(/^[a-z0-9_.-]+$/, "Alias may only contain lowercase letters, numbers, dots, underscores, or dashes"),
  provider: z.enum(["hashicorp", "aws-sm", "env", "supabase-kv"], {
    errorMap: () => ({ message: "Unsupported provider" }),
  }),
  externalId: z.string().min(1, "Provider reference is required"),
  description: z.string().optional(),
});

export async function POST(request: Request) {
  const context = await resolveAdminContext(["platform_admin", "support_agent"]);
  if (context instanceof NextResponse) {
    return context;
  }

  const parsed = await parseJsonBody(request, schema);
  if (parsed instanceof NextResponse) {
    return parsed;
  }

  const tenantOrgId = context.tenantOrgId ?? context.actorOrgId ?? parsed.orgId;
  const actorOrgId = context.actorOrgId ?? context.tenantOrgId ?? parsed.orgId;

  if (!tenantOrgId || !actorOrgId) {
    return NextResponse.json({ error: "Tenant context unavailable" }, { status: 403 });
  }

  try {
    const result = await callAdminRpc<Record<string, unknown>>("admin_bind_secret_alias", {
      actor_id: context.userId,
      org_id: parsed.orgId,
      reason: parsed.reason,
      alias: parsed.alias,
      provider: parsed.provider,
      external_id: parsed.externalId,
      description: parsed.description ?? null,
      tenant_org_id: tenantOrgId,
      actor_org_id: actorOrgId,
      on_behalf_of_org_id: parsed.orgId,
    });

    return NextResponse.json({
      message: "Secret alias bound",
      actionId: result?.action_id ?? null,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to bind secret alias";
    const details = error instanceof Error && "details" in error ? (error as { details?: string }).details : undefined;
    return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status: 400 });
  }
}
