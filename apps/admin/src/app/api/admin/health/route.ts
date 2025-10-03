import { annotateSuccess, withSpan } from "@airnub/utils";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  return withSpan(
    "admin.api.health",
    { attributes: { "http.method": "GET", "http.route": "/api/admin/health" } },
    async (span) => {
      const response = NextResponse.json({ status: "ok", message: "Admin API scaffold" });
      span.setAttributes({ "http.status_code": response.status });
      annotateSuccess(span);
      return response;
    }
  );
}
