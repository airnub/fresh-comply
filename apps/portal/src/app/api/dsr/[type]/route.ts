import { annotateSuccess, withSpan } from "@airnub/utils";
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
  return withSpan(
    "portal.api.dsr.submit",
    { attributes: { "http.method": request.method, "http.route": "/api/dsr/[type]" } },
    async (span) => {
      const type = params.type?.toLowerCase();
      if (!type || !SUPPORTED_TYPES.has(type)) {
        span.setAttributes({ "http.status_code": 404, "freshcomply.validation": "unsupported_dsr" });
        return NextResponse.json({ error: "Unsupported request type" }, { status: 404 });
      }

      const payload = await request.json().catch(() => null);
      const requestId = `dsr-${Date.now()}`;
      const receivedAt = new Date().toISOString();

      span.setAttributes({
        "freshcomply.dsr.type": type,
        "freshcomply.dsr.requestId": requestId,
        "http.status_code": 202
      });

      console.info("DSR request received", { type, requestId, receivedAt, payload });

      annotateSuccess(span);
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
  );
}
