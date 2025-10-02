import { NextResponse } from "next/server";
import { buildICS } from "@airnub/utils/ics";

export async function GET() {
  const ics = buildICS({
    summary: "Demo Deadline",
    start: new Date("2025-10-15T09:00:00Z"),
    end: new Date("2025-10-15T10:00:00Z")
  });
  return new NextResponse(ics, { headers: { "Content-Type": "text/calendar" } });
}
