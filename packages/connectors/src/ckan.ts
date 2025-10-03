import { URL } from "node:url";

export type CkanSearchOptions = {
  baseUrl?: string;
  resourceId: string;
  limit?: number;
  offset?: number;
  q?: string;
  filters?: Record<string, string | number>;
  sort?: string;
  fields?: string[];
  abortSignal?: AbortSignal;
};

export type CkanRecordSet<T> = {
  records: T[];
  total: number;
  resourceId: string;
  issuedAt: string;
  sort?: string;
  fields?: string[];
};

const DEFAULT_BASE_URL = "https://data.gov.ie";

export async function fetchCkanRecords<T>(options: CkanSearchOptions): Promise<CkanRecordSet<T>> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const url = new URL("/api/3/action/datastore_search", baseUrl);

  url.searchParams.set("resource_id", options.resourceId);
  if (typeof options.limit === "number") {
    url.searchParams.set("limit", String(options.limit));
  }
  if (typeof options.offset === "number" && options.offset > 0) {
    url.searchParams.set("offset", String(options.offset));
  }
  if (options.q) {
    url.searchParams.set("q", options.q);
  }
  if (options.sort) {
    url.searchParams.set("sort", options.sort);
  }
  if (options.fields?.length) {
    url.searchParams.set("fields", options.fields.join(","));
  }
  if (options.filters && Object.keys(options.filters).length > 0) {
    url.searchParams.set("filters", JSON.stringify(options.filters));
  }

  const response = await fetch(url, { signal: options.abortSignal });
  if (!response.ok) {
    throw new Error(`CKAN request failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    success: boolean;
    result?: { records: T[]; total: number; sort?: string; fields?: string[]; _links?: { next?: string } };
    error?: { message?: string };
  };

  if (!payload.success || !payload.result) {
    throw new Error(payload.error?.message ?? "CKAN request failed");
  }

  const issuedAt = new Date().toISOString();

  return {
    resourceId: options.resourceId,
    records: payload.result.records ?? [],
    total: payload.result.total ?? payload.result.records?.length ?? 0,
    sort: payload.result.sort,
    fields: payload.result.fields,
    issuedAt
  } satisfies CkanRecordSet<T>;
}

export async function fetchAllCkanRecords<T>(options: CkanSearchOptions & { pageSize?: number; maxPages?: number }) {
  const pageSize = options.pageSize ?? options.limit ?? 100;
  const maxPages = options.maxPages ?? 10;
  const aggregated: T[] = [];
  let offset = options.offset ?? 0;
  let pages = 0;
  let lastIssuedAt = new Date().toISOString();

  while (pages < maxPages) {
    const { records, total, issuedAt } = await fetchCkanRecords<T>({
      ...options,
      limit: pageSize,
      offset
    });
    aggregated.push(...records);
    lastIssuedAt = issuedAt;
    offset += records.length;
    pages += 1;
    if (records.length < pageSize || aggregated.length >= total) {
      break;
    }
  }

  return {
    resourceId: options.resourceId,
    records: aggregated,
    total: aggregated.length,
    issuedAt: lastIssuedAt
  } satisfies CkanRecordSet<T>;
}
