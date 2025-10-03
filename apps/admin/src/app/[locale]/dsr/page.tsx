import { getTranslations } from "next-intl/server";
import { getSupabaseClient, SupabaseConfigurationError } from "../../../lib/auth/supabase-ssr";
import { DsrRowActions } from "../../../../components/DsrRowActions";
import { DataTable } from "../../../../components/DataTable";
import { formatDueDate } from "@airnub/utils/date";
import { DSR_REQUEST_STATUSES, DSR_REQUEST_TYPES } from "@airnub/utils/dsr";

interface DsrSearchParams {
  status?: string;
  type?: string;
  q?: string;
}

interface DsrRow {
  id: string;
  type: string;
  status: string;
  received_at: string;
  ack_sent_at: string | null;
  due_at: string;
  assignee_email: string | null;
  requester_email: string | null;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

async function loadDsrQueue(searchParams: DsrSearchParams) {
  try {
    const client = getSupabaseClient();
    let query = client
      .from("dsr_requests")
      .select("id, type, status, received_at, ack_sent_at, due_at, assignee_email, requester_email")
      .order("received_at", { ascending: false })
      .limit(200);

    if (searchParams.status && DSR_REQUEST_STATUSES.includes(searchParams.status as typeof DSR_REQUEST_STATUSES[number])) {
      query = query.eq("status", searchParams.status);
    }

    if (searchParams.type && DSR_REQUEST_TYPES.includes(searchParams.type as typeof DSR_REQUEST_TYPES[number])) {
      query = query.eq("type", searchParams.type);
    }

    if (searchParams.q) {
      const term = `%${searchParams.q.trim()}%`;
      query = query.or(`id.ilike.${term},requester_email.ilike.${term}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Unable to load DSR queue", error);
      return [] as DsrRow[];
    }

    return (data ?? []) as DsrRow[];
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      console.warn("Supabase unavailable for DSR console", error.message);
      return [];
    }
    throw error;
  }
}

function Filters({ t, searchParams }: { t: Awaited<ReturnType<typeof getTranslations>>; searchParams: DsrSearchParams }) {
  return (
    <form className="flex flex-wrap items-end gap-4" method="get">
      <label className="flex flex-col text-sm text-gray-700">
        <span className="font-medium">{t("filters.status")}</span>
        <select name="status" defaultValue={searchParams.status ?? ""} className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">{t("filters.any")}</option>
          {DSR_REQUEST_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`status.${status}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-sm text-gray-700">
        <span className="font-medium">{t("filters.type")}</span>
        <select name="type" defaultValue={searchParams.type ?? ""} className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">{t("filters.any")}</option>
          {DSR_REQUEST_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`types.${type}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-sm text-gray-700">
        <span className="font-medium">{t("filters.search")}</span>
        <input
          type="search"
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder={t("filters.searchPlaceholder")}
          className="mt-1 w-64 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {t("filters.apply")}
        </button>
        <a
          href="?"
          className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          {t("filters.reset")}
        </a>
      </div>
    </form>
  );
}

export default async function DsrPage({ searchParams }: { searchParams: DsrSearchParams }) {
  const t = await getTranslations({ namespace: "dsr" });
  const requests = await loadDsrQueue(searchParams);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold text-gray-900">{t("heading")}</h2>
        <p className="text-sm text-gray-600">{t("subheading")}</p>
      </header>
      <Filters t={t} searchParams={searchParams} />
      <DataTable
        columns={[
          { key: "id", header: t("columns.reference") },
          {
            key: "type",
            header: t("columns.type"),
            render: (value) => t(`types.${String(value)}`)
          },
          {
            key: "status",
            header: t("columns.status"),
            render: (value) => t(`status.${String(value)}`)
          },
          {
            key: "received_at",
            header: t("columns.received"),
            render: (value) => formatDateTime(typeof value === "string" ? value : null)
          },
          {
            key: "ack_sent_at",
            header: t("columns.acknowledged"),
            render: (value) => formatDateTime(typeof value === "string" ? value : null)
          },
          {
            key: "due_at",
            header: t("columns.due"),
            render: (value) => formatDueDate(typeof value === "string" ? value : undefined)
          },
          {
            key: "requester_email",
            header: t("columns.requester"),
            render: (value) => (typeof value === "string" && value ? value : "—")
          },
          {
            key: "assignee_email",
            header: t("columns.assignee"),
            render: (value, row: DsrRow) => (
              <DsrRowActions requestId={row.id} status={row.status} assigneeEmail={typeof value === "string" ? value : null} />
            )
          }
        ]}
        data={requests}
        caption={t("tableCaption")}
        emptyState={t("empty")}
      />
    </section>
  );
}
