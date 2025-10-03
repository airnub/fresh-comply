import { NextResponse } from "next/server";
import { z } from "zod";
import { callAdminRpc, parseJsonBody, resolveAdminContext } from "../../../../../_lib";

const schema = z.object({
  reason: z.string().min(1, "Reason code is required"),
  dueDate: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Due date must be an ISO-8601 date string",
  }),
});

export async function PATCH(request: Request, { params }: { params: { runId: string; stepId: string } }) {
  const context = await resolveAdminContext(["platform_admin", "support_agent"]);
  if (context instanceof NextResponse) {
    return context;
  }

  const parsed = await parseJsonBody(request, schema);
  if (parsed instanceof NextResponse) {
    return parsed;
  }

  try {
    const result = await callAdminRpc<Record<string, unknown>>("admin_update_step_due_date", {
      actor_id: context.userId,
      run_id: params.runId,
      step_id: params.stepId,
      reason: parsed.reason,
      due_date: parsed.dueDate,
    });

    return NextResponse.json({
      message: "Due date updated",
      actionId: result?.action_id ?? null,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update due date";
    const details = error instanceof Error && "details" in error ? (error as { details?: string }).details : undefined;
    return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status: 400 });
  }
}
