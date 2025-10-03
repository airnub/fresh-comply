import { NextResponse } from "next/server";
import { z } from "zod";
import { callAdminRpc, parseJsonBody, resolveAdminContext } from "../../../_lib";

const schema = z.object({
  reason: z.string().min(1, "Reason code is required"),
  resolution: z.string().min(1, "Resolution notes are required"),
});

export async function POST(request: Request, { params }: { params: { requestId: string } }) {
  const context = await resolveAdminContext(["platform_admin", "support_agent", "dpo"]);
  if (context instanceof NextResponse) {
    return context;
  }

  const parsed = await parseJsonBody(request, schema);
  if (parsed instanceof NextResponse) {
    return parsed;
  }

  try {
    const result = await callAdminRpc<Record<string, unknown>>("admin_resolve_dsr", {
      actor_id: context.userId,
      request_id: params.requestId,
      reason: parsed.reason,
      resolution: parsed.resolution,
    });

    return NextResponse.json({
      message: "DSR resolved",
      actionId: result?.action_id ?? null,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve DSR";
    const details = error instanceof Error && "details" in error ? (error as { details?: string }).details : undefined;
    return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status: 400 });
  }
}
