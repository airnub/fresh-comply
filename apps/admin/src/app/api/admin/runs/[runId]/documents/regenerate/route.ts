import { NextResponse } from "next/server";
import { z } from "zod";
import { callAdminRpc, parseJsonBody, resolveAdminContext } from "../../../../_lib";

const schema = z.object({
  reason: z.string().min(1, "Reason code is required"),
  documentId: z.string().uuid("Document identifier must be a UUID"),
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
    const result = await callAdminRpc<Record<string, unknown>>("admin_regenerate_document", {
      actor_id: context.userId,
      run_id: params.runId,
      reason: parsed.reason,
      document_id: parsed.documentId,
    });

    return NextResponse.json({
      message: "Document regeneration queued",
      actionId: result?.action_id ?? null,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to queue regeneration";
    const details = error instanceof Error && "details" in error ? (error as { details?: string }).details : undefined;
    return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status: 400 });
  }
}
