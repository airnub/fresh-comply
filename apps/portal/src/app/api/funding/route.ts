import { NextResponse } from "next/server";
import { listFundingOpportunities } from "../../../server/funding";
import { SupabaseConfigurationError } from "../../../server/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? undefined;
  const domain = url.searchParams.get("domain") ?? undefined;
  const county = url.searchParams.get("county") ?? undefined;
  const callYearParam = url.searchParams.get("callYear");
  const limitParam = url.searchParams.get("limit");

  const callYear = callYearParam ? Number.parseInt(callYearParam, 10) : undefined;
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

  try {
    const results = await listFundingOpportunities({
      search,
      domain,
      county,
      callYear: Number.isFinite(callYear) ? callYear : undefined,
      limit: Number.isFinite(limit) ? limit : undefined
    });

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
