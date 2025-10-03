import type { CkanRecordSet } from "./ckan.js";
import { fetchCkanRecords } from "./ckan.js";

export type CharityRegistrationRecord = {
  _id: number;
  "Charities Regulator Registration Stats for 2023": string;
  [month: string]: string | number | null;
};

export type FetchCharitiesOptions = {
  limit?: number;
  baseUrl?: string;
  abortSignal?: AbortSignal;
};

const DEFAULT_RESOURCE_ID = "9f3f7436-e9ba-4599-accd-ab34560557b6";

export type CharitiesDatasetResult = CkanRecordSet<CharityRegistrationRecord>;

export async function fetchCharitiesDataset(
  query: string,
  options: FetchCharitiesOptions = {}
): Promise<CharitiesDatasetResult> {
  const resourceId = process.env.CHARITIES_CKAN_RESOURCE_ID ?? DEFAULT_RESOURCE_ID;
  const limit = Math.max(1, Math.min(options.limit ?? 25, 100));

  const { records, ...rest } = await fetchCkanRecords<CharityRegistrationRecord>({
    baseUrl: options.baseUrl,
    resourceId,
    limit,
    q: query,
    sort: "_id asc",
    abortSignal: options.abortSignal
  });

  return {
    ...rest,
    records: records.map((record) => ({
      ...record,
      query
    }))
  } satisfies CharitiesDatasetResult;
}
