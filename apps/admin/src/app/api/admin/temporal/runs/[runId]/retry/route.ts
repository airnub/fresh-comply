import { NextResponse } from "next/server";
import { z } from "zod";
import { callAdminRpc, parseJsonBody, resolveAdminContext } from "../../../../_lib";

const schema = z.object({
  reason: z.string().min(1, "Reason code is required"),
  activityId: z.string().min(1, "Activity identifier is required"),
});

export async function POST(request: Request, { params }: { params: { runId: string } }) {
  const context = await resolveAdminContext(["platform_admin", "support_agent"]);
  if (context instanceof NextResponse) {
    return context;
  }

  const parsed = await parseJsonBody(request, schema);
  if (parsed instanceof NextResponse) {
    return parsed;
  }

  try {
    const result = await callAdminRpc<Record<string, unknown>>("admin_temporal_retry", {
      actor_id: context.userId,
      run_id: params.runId,
      reason: parsed.reason,
      activity_id: parsed.activityId,
    });

    return NextResponse.json({
      message: "Activity retry requested",
      actionId: result?.action_id ?? null,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to request retry";
    const details = error instanceof Error && "details" in error ? (error as { details?: string }).details : undefined;
    return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status: 400 });
  }
}
