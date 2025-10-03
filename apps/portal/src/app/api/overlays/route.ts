import { NextResponse } from "next/server";
import {
  getSupabaseClient,
  SupabaseConfigurationError,
} from "../../../server/supabase";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { ok: false, error: "Request body must be an object" },
      { status: 400 }
    );
  }

  const { tenantId, workflowId, overlay, mergedWorkflow } = payload as {
    tenantId?: string;
    workflowId?: string;
    overlay?: unknown;
    mergedWorkflow?: unknown;
  };

  if (!tenantId || !workflowId || !Array.isArray(overlay) || !mergedWorkflow) {
    return NextResponse.json(
      { ok: false, error: "Missing tenantId, workflowId, overlay, or mergedWorkflow" },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("workflow_overlay_snapshots").insert({
      run_id: null,
      tenant_overlay_id: null,
      applied_overlays: overlay,
      merged_workflow: mergedWorkflow,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
