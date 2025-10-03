import { getTranslations } from "next-intl/server";
import { DataTable } from "../../../../components/DataTable";
import { CasesActions } from "../../../../components/CasesActions";

const cases = [
  { id: "case-1", subject: "Missing evidence", status: "triage" },
  { id: "case-2", subject: "Run blocked", status: "in_progress" },
];

export default async function CasesPage() {
  const t = await getTranslations({ namespace: "cases" });

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold text-gray-900">{t("heading")}</h2>
        <p className="text-sm text-gray-600">{t("subheading")}</p>
      </header>
      <CasesActions />
      <DataTable
        columns={[
          { key: "subject", header: t("columns.subject") },
          { key: "status", header: t("columns.status") }
        ]}
        data={cases}
        caption={t("tableCaption")}
        emptyState={t("empty")}
      />
    </section>
  );
}
