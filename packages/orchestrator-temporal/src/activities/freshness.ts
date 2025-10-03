import { annotateSuccess, recordSpanError, withSpan } from "@airnub/utils";
import { createClient } from "@supabase/supabase-js";
import type { SourceKey, WatchEvent } from "@airnub/freshness/watcher";
import { pollSource } from "@airnub/freshness/watcher";
import type { Database } from "@airnub/types/supabase";

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
  return withSpan(
    "temporal.activity.refreshFreshnessSource",
    { attributes: { "freshcomply.sourceKey": input.sourceKey } },
    async (span) => {
      const client = getSupabaseClient();
      const workflows = input.workflows ?? DEFAULT_WORKFLOW_ROUTES[input.sourceKey];
      if (workflows?.length) {
        span.setAttributes({ "freshcomply.freshness.workflowCount": workflows.length });
      }
      const event = await pollSource(input.sourceKey, {
        supabase: client,
        workflows,
        metadata: input.metadata
      });
      if (event?.current) {
        span.setAttributes({ "freshcomply.freshness.updated": true });
        await persistMaterializedViews(client, input.sourceKey, event);
      }
      annotateSuccess(span, { "freshcomply.freshness.hasEvent": event ? 1 : 0 });
      return event;
    }
  );
}

export async function refreshAllSources(options?: { workflows?: string[] }) {
  return withSpan(
    "temporal.activity.refreshAllSources",
    {},
    async (span) => {
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
      span.setAttributes({ "freshcomply.freshness.sources": keys.length, "freshcomply.freshness.events": events.length });
      annotateSuccess(span);
      return events;
    }
  );
}

async function persistMaterializedViews(
  client: ReturnType<typeof getSupabaseClient>,
  sourceKey: SourceKey,
  event: WatchEvent
) {
  await withSpan(
    "temporal.activity.persistMaterializedViews",
    { attributes: { "freshcomply.sourceKey": sourceKey } },
    async (span) => {
      try {
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
        annotateSuccess(span);
      } catch (error) {
        recordSpanError(span, error);
        throw error;
      }
    }
  );
}

function toDateString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.slice(0, 10);
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
  const rows = event.current.payload.map((row) => {
    const record = row as Record<string, unknown>;
    const address = {
      line1: record.company_address_1 ?? null,
      line2: record.company_address_2 ?? null,
      line3: record.company_address_3 ?? null,
      line4: record.company_address_4 ?? null
    };
    return {
      company_number: String(record.company_num ?? record.company_number ?? ""),
      name: String(record.company_name ?? ""),
      status: (record.company_status as string | null) ?? null,
      company_type: (record.company_type as string | null) ?? null,
      registered_on: toDateString(record.company_reg_date),
      dissolved_on: toDateString(record.comp_dissolved_date),
      last_return_date: toDateString(record.last_ar_date),
      address,
      eircode: (record.eircode as string | null) ?? null,
      metadata: {
        status_code: record.company_status_code ?? null,
        type_code: record.company_type_code ?? null,
        principal_object_code: record.princ_object_code ?? null
      },
      snapshot_fingerprint: event.current.fingerprint,
      source_resource_id: resourceId ?? "unknown",
      refreshed_at: new Date().toISOString()
    };
  });

  const filtered = rows.filter((row) => row.company_number);
  if (!filtered.length) return;

  const { error } = await client.from("cro_companies").upsert(filtered, { onConflict: "company_number" });
  if (error) {
    console.warn("Failed to upsert CRO companies", error);
  }
}

async function persistCharityMetrics(client: ReturnType<typeof getSupabaseClient>, event: WatchEvent) {
  const resourceId = (event.current.metadata?.resourceId as string | undefined) ?? null;
  const rows = event.current.payload.map((row) => {
    const record = row as Record<string, unknown>;
    const metricKey = String(record._id ?? record.metric_key ?? "metric-unknown");
    const { _id: _omit, query: _query, ...rest } = record;
    return {
      metric_key: metricKey,
      metric_label: String(record["Charities Regulator Registration Stats for 2023"] ?? metricKey),
      values_json: rest,
      source_resource_id: resourceId,
      snapshot_fingerprint: event.current.fingerprint,
      refreshed_at: new Date().toISOString()
    };
  });

  if (!rows.length) return;

  const { error } = await client.from("charity_registration_metrics").upsert(rows, { onConflict: "metric_key" });
  if (error) {
    console.warn("Failed to upsert charity metrics", error);
  }
}

async function persistRevenueCharities(client: ReturnType<typeof getSupabaseClient>, event: WatchEvent) {
  const resourceId = (event.current.metadata?.resourceId as string | undefined) ?? null;
  const rows = event.current.payload.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      id: undefined,
      charity_name: String(record["Charity Name"] ?? ""),
      charity_address: (record["Charity Address"] as string | null) ?? null,
      source_resource_id: resourceId ?? "unknown",
      snapshot_fingerprint: event.current.fingerprint,
      refreshed_at: new Date().toISOString()
    };
  }).filter((row) => row.charity_name);

  if (!rows.length) return;

  const { error } = await client
    .from("revenue_charity_registry")
    .upsert(rows, { onConflict: "charity_name,source_resource_id" });
  if (error) {
    console.warn("Failed to upsert Revenue charity registry", error);
  }
}

async function persistFundingOpportunities(client: ReturnType<typeof getSupabaseClient>, event: WatchEvent) {
  const resourceId = (event.current.metadata?.resourceId as string | undefined) ?? null;
  const rows = event.current.payload.map((row) => {
    const record = row as Record<string, unknown>;
    const externalId = String(record._id ?? record.external_id ?? "");
    return {
      external_id: externalId,
      source_resource_id: resourceId ?? "unknown",
      title: String(record.title ?? record["Project Title"] ?? "Untitled opportunity"),
      summary: (record.summary as string | null) ?? (record["Project Summary"] as string | null) ?? null,
      call_year: typeof record.callYear === "number" ? (record.callYear as number) : (typeof record["Call Year"] === "number" ? (record["Call Year"] as number) : null),
      call_type: (record.callType as string | null) ?? (record["Call Type"] as string | null) ?? null,
      domain: normalizeDomain(
        (record.callType as string | null) ?? (record["Call Type"] as string | null) ?? null
      ),
      lead_institution:
        (record.leadIrishInstitution as string | null) ?? (record["Lead Irish Institution"] as string | null) ?? null,
      county: inferCountyFromLead(
        (record.leadIrishInstitution as string | null) ?? (record["Lead Irish Institution"] as string | null) ?? null
      ),
      acronym: (record.acronym as string | null) ?? null,
      amount_awarded:
        typeof record.amountAwarded === "number"
          ? (record.amountAwarded as number)
          : typeof record["Amount Awarded"] === "number"
            ? (record["Amount Awarded"] as number)
            : null,
      currency: (record.currency as string | null) ?? (record.Unit as string | null) ?? null,
      metadata: {
        call_year_raw: record["Call Year"],
        amount_awarded_raw: record["Amount Awarded"],
        unit_raw: record.Unit,
        county: inferCountyFromLead(
          (record.leadIrishInstitution as string | null) ?? (record["Lead Irish Institution"] as string | null) ?? null
        )
      },
      snapshot_fingerprint: event.current.fingerprint,
      refreshed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }).filter((row) => row.external_id);

  if (!rows.length) return;

  const { error } = await client
    .from("funding_opportunities")
    .upsert(rows, { onConflict: "external_id,source_resource_id" });
  if (error) {
    console.warn("Failed to upsert funding opportunities", error);
  }
}
