import type { CkanRecordSet } from "./ckan.js";
import { fetchCkanRecords } from "./ckan.js";

export type CroCompanyRecord = {
  _id: number;
  company_num: number;
  company_name: string;
  company_status: string | null;
  company_type: string | null;
  company_reg_date: string | null;
  last_ar_date: string | null;
  comp_dissolved_date: string | null;
  company_address_1: string | null;
  company_address_2: string | null;
  company_address_3: string | null;
  company_address_4: string | null;
  eircode: string | null;
};

export type CroLookupResult = CkanRecordSet<CroCompanyRecord>;

const DEFAULT_RESOURCE_ID = "3fef41bc-b8f4-4b10-8434-ce51c29b1bba";

export type LookupCompanyOptions = {
  limit?: number;
  baseUrl?: string;
  abortSignal?: AbortSignal;
};

export async function lookupCompanyByName(name: string, options: LookupCompanyOptions = {}): Promise<CroLookupResult> {
  if (!name?.trim()) {
    throw new Error("Company name query is required for CRO lookup");
  }

  const resourceId = process.env.CRO_CKAN_RESOURCE_ID ?? DEFAULT_RESOURCE_ID;
  const limit = Math.max(1, Math.min(options.limit ?? 20, 100));

  return fetchCkanRecords<CroCompanyRecord>({
    baseUrl: options.baseUrl,
    resourceId,
    limit,
    q: name,
    sort: "company_name asc",
    abortSignal: options.abortSignal
  });
}
