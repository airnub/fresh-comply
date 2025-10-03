import { cache } from "react";
import type { Tables } from "@airnub/types/supabase";
import {
  getSupabaseClient,
  SupabaseConfigurationError
} from "./supabase";

export type FundingOpportunityRow = Tables<"funding_opportunities">;

export type FundingFilters = {
  search?: string;
  domain?: string;
  county?: string;
  callYear?: number;
  limit?: number;
};

export type FundingList = {
  opportunities: FundingOpportunityRow[];
  total: number;
};

export const listFundingOpportunities = cache(async function listFundingOpportunities(
  filters: FundingFilters = {}
): Promise<FundingList> {
  try {
    const supabase = getSupabaseClient();
    let query = supabase
      .from("funding_opportunities")
      .select("*", { count: "exact" })
      .order("call_year", { ascending: false })
      .order("amount_awarded", { ascending: false, nullsFirst: false });

    if (filters.search) {
      query = query.ilike("title", `%${filters.search}%`);
    }
    if (filters.domain) {
      query = query.eq("domain", filters.domain);
    }
    if (filters.county) {
      query = query.eq("county", filters.county);
    }
    if (filters.callYear) {
      query = query.eq("call_year", filters.callYear);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    } else {
      query = query.limit(50);
    }

    const { data, error, count } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return {
      opportunities: data ?? [],
      total: count ?? 0
    };
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      throw error;
    }
    throw new Error(`Unable to load funding opportunities: ${(error as Error).message}`);
  }
});

export function extractFilterOptions(rows: FundingOpportunityRow[]) {
  const domains = new Set<string>();
  const counties = new Set<string>();
  const years = new Set<number>();
  for (const row of rows) {
    if (row.domain) domains.add(row.domain);
    if (row.county) counties.add(row.county);
    if (row.call_year) years.add(row.call_year);
  }
  return {
    domains: Array.from(domains).sort(),
    counties: Array.from(counties).sort(),
    years: Array.from(years).sort((a, b) => b - a)
  };
}
