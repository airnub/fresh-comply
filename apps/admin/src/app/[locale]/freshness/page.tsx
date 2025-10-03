import { getTranslations } from "next-intl/server";
import { DataTable } from "../../../../components/DataTable";
import { DiffViewer } from "../../../../components/DiffViewer";
import { FreshnessActions } from "../../../../components/FreshnessActions";

const drafts = [
  {
    id: "wf-01",
    watcher: "Revenue Annual Return",
    impact: "High",
  },
];

export default async function FreshnessPage() {
  const t = await getTranslations({ namespace: "freshness" });

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold text-gray-900">{t("heading")}</h2>
        <p className="text-sm text-gray-600">{t("subheading")}</p>
      </header>
      <DataTable
        columns={[
          { key: "watcher", header: t("columns.watcher") },
          { key: "impact", header: t("columns.impact") }
        ]}
        data={drafts}
        caption={t("tableCaption")}
        emptyState={t("empty")}
      />
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <header className="space-y-1">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t("diffHeading")}</h3>
          <p className="text-xs text-gray-500">{t("diffHint")}</p>
        </header>
        <DiffViewer
          before="definition_version: 12
threshold: medium"
          after="definition_version: 13
threshold: high"
        />
        <div className="mt-4">
          <FreshnessActions watcherId="wf-01" />
        </div>
      </section>
    </section>
  );
}
