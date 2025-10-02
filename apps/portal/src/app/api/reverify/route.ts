import { NextResponse } from "next/server";
import { reverifyRule } from "../../../../lib/demo-data";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const ruleId = body.ruleId as string | undefined;
  if (!ruleId) {
    return NextResponse.json({ ok: false, error: "ruleId required" }, { status: 400 });
  }
  const result = await reverifyRule(ruleId);
  if (!result) {
    return NextResponse.json({ ok: false, error: "rule not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, rule: result });
}
