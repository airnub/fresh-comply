import type { CkanRecordSet } from "./ckan.js";
import { fetchAllCkanRecords } from "./ckan.js";

export async function submitTR2Draft(payload: Record<string, unknown>) {
  return { status: "queued", reference: "ROS-TODO", payload } as const;
}

export type RevenueCharityRecord = {
  _id: number;
  "Charity Name": string;
  "Charity Address": string;
};

export type RevenueCharityResult = CkanRecordSet<RevenueCharityRecord>;

const DEFAULT_RESOURCE_ID = "09e92334-b853-404f-91cd-14ab5cfe4aa5";

export type FetchRevenueCharityOptions = {
  baseUrl?: string;
  limit?: number;
  abortSignal?: AbortSignal;
};

export async function fetchRevenueCharityRegistrations(
  options: FetchRevenueCharityOptions = {}
): Promise<RevenueCharityResult> {
  const resourceId = process.env.REVENUE_CHARITY_RESOURCE_ID ?? DEFAULT_RESOURCE_ID;
  const limit = options.limit ?? 500;
  const { records, issuedAt } = await fetchAllCkanRecords<RevenueCharityRecord>({
    resourceId,
    baseUrl: options.baseUrl,
    pageSize: Math.min(limit, 500),
    maxPages: Math.ceil(limit / 500),
    abortSignal: options.abortSignal
  });

  return {
    resourceId,
    records: records.slice(0, limit),
    total: Math.min(records.length, limit),
    issuedAt
  } satisfies RevenueCharityResult;
}
