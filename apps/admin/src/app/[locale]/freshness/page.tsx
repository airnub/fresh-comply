import { getTranslations } from "next-intl/server";
import { DataTable } from "../../../../components/DataTable";
import { DiffViewer } from "../../../../components/DiffViewer";
import { FreshnessActions } from "../../../../components/FreshnessActions";
import { getPendingFreshnessUpdates, resolveSourceLabel } from "../../../../server/freshness";

export default async function FreshnessPage() {
  const t = await getTranslations({ namespace: "freshness" });
  const updates = await getPendingFreshnessUpdates();
  const selected = updates[0];

  const before = selected?.previous ? formatPayload(selected.previous) : null;
  const after = selected?.current ? formatPayload(selected.current) : null;

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold text-gray-900">{t("heading")}</h2>
        <p className="text-sm text-gray-600">{t("subheading")}</p>
      </header>
      <DataTable
        columns={[
          { key: "source", header: t("columns.watcher") },
          { key: "status", header: t("columns.status") },
          {
            key: "detectedAt",
            header: t("columns.detected"),
            render: (value: string) => new Date(value).toLocaleString()
          },
          {
            key: "workflows",
            header: t("columns.workflows"),
            render: (value: string[]) => (value.length ? value.join(", ") : t("noWorkflows"))
          }
        ]}
        data={updates.map((update) => ({
          id: update.id,
          source: resolveSourceLabel(update.sourceKey),
          status: t(`statuses.${update.status}` as const),
          detectedAt: update.detectedAt,
          workflows: update.workflows
        }))}
        caption={t("tableCaption")}
        emptyState={t("empty")}
      />
      {selected ? (
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <header className="space-y-1">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t("diffHeading")}</h3>
            <p className="text-xs text-gray-500">{t("diffHint")}</p>
            <p className="text-xs text-gray-500">
              {t("selectedSource", { source: resolveSourceLabel(selected.sourceKey) })}
            </p>
            {selected.verifiedAt ? (
              <p className="text-xs text-emerald-600">
                {t("verifiedOn", { date: new Date(selected.verifiedAt).toLocaleString() })}
              </p>
            ) : null}
          </header>
          <DiffViewer before={before} after={after} />
          <div className="mt-4">
            <FreshnessActions watcherId={selected.id} status={selected.status} diff={selected.diff} />
          </div>
        </section>
      ) : null}
    </section>
  );
}

function formatPayload(value: unknown) {
  if (!value) return null;
  return JSON.stringify(value, null, 2);
}
