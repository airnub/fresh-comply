import type { CkanRecordSet } from "./ckan.js";
import { fetchCkanRecords } from "./ckan.js";

export type FundingOpportunity = {
  callYear: number | null;
  callType: string | null;
  title: string;
  summary: string | null;
  leadIrishInstitution: string | null;
  acronym: string | null;
  amountAwarded: number | null;
  currency: string | null;
  url?: string | null;
};

export type FundingRadarResult = CkanRecordSet<FundingOpportunity & { _id: number }>; // include CKAN row id

const DEFAULT_RESOURCE_ID = "0664bea6-7ced-4efc-8233-445c067158bb";

export type FundingHarvestOptions = {
  limit?: number;
  baseUrl?: string;
  abortSignal?: AbortSignal;
};

export async function harvestFundingRadar(
  options: FundingHarvestOptions = {}
): Promise<FundingRadarResult> {
  const resourceId = process.env.FUNDING_RESOURCE_ID ?? DEFAULT_RESOURCE_ID;
  const limit = Math.max(1, Math.min(options.limit ?? 50, 200));
  const raw = await fetchCkanRecords<Record<string, unknown>>({
    resourceId,
    baseUrl: options.baseUrl,
    limit,
    sort: "\"Call Year\" desc",
    abortSignal: options.abortSignal
  });

  const mapped = raw.records.map((record) => {
    const callYear = typeof record["Call Year"] === "number" ? (record["Call Year"] as number) : null;
    const amountAwarded = typeof record["Amount Awarded"] === "number" ? (record["Amount Awarded"] as number) : null;
    return {
      _id: record._id as number,
      callYear,
      callType: typeof record["Call Type"] === "string" ? (record["Call Type"] as string) : null,
      title: String(record["Project Title"] ?? record["Lead Irish Institution"] ?? "Unknown opportunity"),
      summary: typeof record["Project Summary"] === "string" ? (record["Project Summary"] as string) : null,
      leadIrishInstitution:
        typeof record["Lead Irish Institution"] === "string" ? (record["Lead Irish Institution"] as string) : null,
      acronym: typeof record["Acronym"] === "string" ? (record["Acronym"] as string) : null,
      amountAwarded,
      currency: typeof record["Unit"] === "string" ? (record["Unit"] as string) : null,
      url: typeof record["Project Link"] === "string" ? (record["Project Link"] as string) : null
    } satisfies FundingOpportunity & { _id: number };
  });

  return {
    ...raw,
    records: mapped
  } satisfies FundingRadarResult;
}

export function toCalendarEvent(opportunity: FundingOpportunity & { _id: number }) {
  const start = opportunity.callYear ? new Date(Date.UTC(opportunity.callYear, 0, 1)) : new Date();
  return {
    uid: `funding-${opportunity._id}`,
    start,
    end: new Date(start.getTime() + 1000 * 60 * 60 * 24),
    title: opportunity.title,
    description: opportunity.summary ?? undefined,
    url: opportunity.url ?? undefined
  };
}
