import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { SourceKey, WatchEvent } from "@airnub/freshness/watcher";
import { pollSource } from "@airnub/freshness/watcher";
import type { Database, Json } from "@airnub/types/supabase";
import { annotateSpan, withTelemetrySpan } from "@airnub/utils/telemetry";

export type RefreshSourceInput = {
  sourceKey: SourceKey;
  workflows?: string[];
  metadata?: Record<string, unknown>;
};

const DEFAULT_WORKFLOW_ROUTES: Partial<Record<SourceKey, string[]>> = {
  funding_radar: ["funding_radar_index"],
  cro_open_services: ["company_name_check"],
  charities_ckan: ["charity_register_refresh"],
  revenue_charities: ["charity_tax_relief_check"]
};

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for freshness polling");
  }
  return { url, key };
}

function getSupabaseClient() {
  const { url, key } = getSupabaseEnv();
  return createClient<Database>(url, key, {
    auth: { persistSession: false }
  });
}

export async function refreshFreshnessSource(input: RefreshSourceInput): Promise<WatchEvent | null> {
  return withTelemetrySpan("temporal.activity.refreshFreshnessSource", {
    attributes: {
      "freshcomply.temporal.activity": "refreshFreshnessSource",
      "freshcomply.source_key": input.sourceKey
    }
  }, async (span) => {
    const client = getSupabaseClient();
    const workflows = input.workflows ?? DEFAULT_WORKFLOW_ROUTES[input.sourceKey];
    const event = await pollSource(input.sourceKey, {
      supabase: client,
      workflows,
      metadata: input.metadata
    });
    if (event?.current) {
      await persistMaterializedViews(client, input.sourceKey, event);
      annotateSpan(span, {
        attributes: {
          "freshcomply.freshness.fingerprint": event.current.fingerprint,
          "freshcomply.freshness.rows": event.current.payload.length
        }
      });
    }
    return event;
  });
}

export async function refreshAllSources(options?: { workflows?: string[] }) {
  return withTelemetrySpan("temporal.activity.refreshAllSources", {
    attributes: {
      "freshcomply.temporal.activity": "refreshAllSources"
    }
  }, async (span) => {
    const keys: SourceKey[] = [
      "cro_open_services",
      "charities_ckan",
      "revenue_charities",
      "funding_radar"
    ];
    const events: WatchEvent[] = [];
    for (const key of keys) {
      const event = await refreshFreshnessSource({ sourceKey: key, workflows: options?.workflows });
      if (event) {
        events.push(event);
      }
    }
    annotateSpan(span, { attributes: { "freshcomply.freshness.refreshed_sources": events.length } });
    return events;
  });
}

async function persistMaterializedViews(
  client: ReturnType<typeof getSupabaseClient>,
  sourceKey: SourceKey,
  event: WatchEvent
) {
  switch (sourceKey) {
    case "cro_open_services":
      await persistCroCompanies(client, event);
      break;
    case "charities_ckan":
      await persistCharityMetrics(client, event);
      break;
    case "revenue_charities":
      await persistRevenueCharities(client, event);
      break;
    case "funding_radar":
      await persistFundingOpportunities(client, event);
      break;
    default:
      break;
  }
}

function toDateString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.slice(0, 10);
  }
  return null;
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return String(value ?? "").trim() || null;
}

function coerceToJson(value: unknown): Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => coerceToJson(item)) as Json;
  }
  if (typeof value === "object") {
    const result: Record<string, Json> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const coerced = coerceToJson(entry);
      if (coerced !== undefined) {
        result[key] = coerced;
      }
    }
    return result as Json;
  }
  return String(value ?? "");
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const COUNTY_KEYWORDS = [
  "Carlow",
  "Cavan",
  "Clare",
  "Cork",
  "Donegal",
  "Dublin",
  "Galway",
  "Kerry",
  "Kildare",
  "Kilkenny",
  "Laois",
  "Leitrim",
  "Limerick",
  "Longford",
  "Louth",
  "Mayo",
  "Meath",
  "Monaghan",
  "Offaly",
  "Roscommon",
  "Sligo",
  "Tipperary",
  "Waterford",
  "Westmeath",
  "Wexford",
  "Wicklow"
];

function inferCountyFromLead(lead: string | null | undefined): string | null {
  if (!lead) return null;
  for (const county of COUNTY_KEYWORDS) {
    if (lead.toLowerCase().includes(county.toLowerCase())) {
      return county;
    }
  }
  return null;
}

function normalizeDomain(callType: string | null | undefined): string | null {
  if (!callType) return null;
  return callType.replace(/\s+/g, " ").trim();
}

async function persistCroCompanies(client: ReturnType<typeof getSupabaseClient>, event: WatchEvent) {
  const resourceId = (event.current.metadata?.resourceId as string | undefined) ?? null;
  const rows = event.current.payload
    .map((row) => {
      const record = row as Record<string, unknown>;
      const companyNumber = toNullableString(record.company_num ?? record.company_number);
      if (!companyNumber) {
        return null;
      }
      const addressFields = {
        line1: toNullableString(record.company_address_1),
        line2: toNullableString(record.company_address_2),
        line3: toNullableString(record.company_address_3),
        line4: toNullableString(record.company_address_4)
      };
      const hasAddress = Object.values(addressFields).some((value) => value !== null);
      const metadataFields = {
        status_code: record.company_status_code ?? null,
        type_code: record.company_type_code ?? null,
        principal_object_code: record.princ_object_code ?? null
      } satisfies Record<string, unknown>;

      const rowData: Database["public"]["Tables"]["cro_companies"]["Insert"] = {
        company_number: companyNumber,
        name: toNullableString(record.company_name) ?? "Unknown",
        status: toNullableString(record.company_status),
        company_type: toNullableString(record.company_type),
        registered_on: toDateString(record.company_reg_date),
        dissolved_on: toDateString(record.comp_dissolved_date),
        last_return_date: toDateString(record.last_ar_date),
        address: hasAddress ? coerceToJson(addressFields) : null,
        eircode: toNullableString(record.eircode),
        metadata: coerceToJson(metadataFields),
        snapshot_fingerprint: event.current.fingerprint,
        source_resource_id: resourceId ?? "unknown",
        refreshed_at: new Date().toISOString()
      };
      return rowData;
    })
    .filter((row): row is Database["public"]["Tables"]["cro_companies"]["Insert"] => row !== null);

  if (!rows.length) return;

  const { error } = await client.from("cro_companies").upsert(rows, { onConflict: "company_number" });
  if (error) {
    console.warn("Failed to upsert CRO companies", error);
  }
}

async function persistCharityMetrics(client: ReturnType<typeof getSupabaseClient>, event: WatchEvent) {
  const resourceId = (event.current.metadata?.resourceId as string | undefined) ?? null;
  const rows = event.current.payload
    .map((row) => {
      const record = row as Record<string, unknown>;
      const metricKey = toNullableString(record._id ?? record.metric_key) ?? undefined;
      if (!metricKey) {
        return null;
      }
      const { _id: _omit, query: _query, ...rest } = record;
      const values = coerceToJson(rest);
      const rowData: Database["public"]["Tables"]["charity_registration_metrics"]["Insert"] = {
        metric_key: metricKey,
        metric_label:
          toNullableString(record["Charities Regulator Registration Stats for 2023"]) ?? metricKey,
        values_json: values,
        source_resource_id: resourceId,
        snapshot_fingerprint: event.current.fingerprint,
        refreshed_at: new Date().toISOString()
      };
      return rowData;
    })
    .filter((row): row is Database["public"]["Tables"]["charity_registration_metrics"]["Insert"] => row !== null);

  if (!rows.length) return;

  const { error } = await client
    .from("charity_registration_metrics")
    .upsert(rows, { onConflict: "metric_key" });
  if (error) {
    console.warn("Failed to upsert charity metrics", error);
  }
}

async function persistRevenueCharities(client: ReturnType<typeof getSupabaseClient>, event: WatchEvent) {
  const resourceId = (event.current.metadata?.resourceId as string | undefined) ?? null;
  const rows = event.current.payload
    .map((row) => {
      const record = row as Record<string, unknown>;
      const charityName =
        toNullableString(record["Charity Name"] ?? record.charity_name ?? record.name) ?? undefined;
      if (!charityName) {
        return null;
      }

      const rowData: Database["public"]["Tables"]["revenue_charity_registry"]["Insert"] = {
        charity_name: charityName,
        charity_address: toNullableString(record["Charity Address"] ?? record.address),
        source_resource_id: resourceId ?? "unknown",
        snapshot_fingerprint: event.current.fingerprint,
        refreshed_at: new Date().toISOString()
      };

      return rowData;
    })
    .filter((row): row is Database["public"]["Tables"]["revenue_charity_registry"]["Insert"] => row !== null);

  if (!rows.length) return;

  const { error } = await client
    .from("revenue_charity_registry")
    .upsert(rows, { onConflict: "charity_name,source_resource_id" });
  if (error) {
    console.warn("Failed to upsert revenue charities", error);
  }
}

async function persistFundingOpportunities(client: ReturnType<typeof getSupabaseClient>, event: WatchEvent) {
  const resourceId = (event.current.metadata?.resourceId as string | undefined) ?? null;
  const rows = event.current.payload
    .map((row) => {
      const record = row as Record<string, unknown>;
      const externalId =
        toNullableString(record.external_id ?? record._id ?? record.id) ?? randomUUID();
      const idValue = toNullableString(record.id) ?? externalId;
      const callType = toNullableString(record.call_type);
      const domain = normalizeDomain(toNullableString(record.domain ?? callType));
      const directCounty = toNullableString(record.county);
      const county = directCounty ?? inferCountyFromLead(toNullableString(record.lead_institution));

      const rowData: Database["public"]["Tables"]["funding_opportunities"]["Insert"] = {
        id: idValue,
        external_id: externalId,
        source_resource_id: resourceId ?? "unknown",
        title: toNullableString(record.title) ?? "Untitled",
        summary: toNullableString(record.summary),
        call_year: toNumberOrNull(record.call_year),
        call_type: callType,
        domain,
        county,
        lead_institution: toNullableString(record.lead_institution),
        acronym: toNullableString(record.acronym),
        amount_awarded: toNumberOrNull(record.amount_awarded),
        currency: toNullableString(record.currency),
        metadata: coerceToJson(record),
        snapshot_fingerprint: event.current.fingerprint,
        refreshed_at: new Date().toISOString()
      };

      return rowData;
    }) as Database["public"]["Tables"]["funding_opportunities"]["Insert"][];

  if (!rows.length) return;

  const { error } = await client
    .from("funding_opportunities")
    .upsert(rows, { onConflict: "external_id" });
  if (error) {
    console.warn("Failed to upsert funding opportunities", error);
  }
}
