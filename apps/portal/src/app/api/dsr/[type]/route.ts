import { NextRequest, NextResponse } from "next/server";

const SUPPORTED_TYPES = new Set([
  "access",
  "export",
  "rectification",
  "erasure",
  "restriction",
  "objection",
  "portability"
]);

export async function POST(request: NextRequest, { params }: { params: { type: string } }) {
  const type = params.type?.toLowerCase();
  if (!type || !SUPPORTED_TYPES.has(type)) {
    return NextResponse.json({ error: "Unsupported request type" }, { status: 404 });
  }

  const payload = await request.json().catch(() => null);
  const requestId = `dsr-${Date.now()}`;
  const receivedAt = new Date().toISOString();

  console.info("DSR request received", { type, requestId, receivedAt, payload });

  return NextResponse.json(
    {
      status: "accepted",
      requestId,
      type,
      receivedAt
    },
    { status: 202 }
  );
}
