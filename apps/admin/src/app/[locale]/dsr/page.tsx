import { getTranslations } from "next-intl/server";
import { DataTable } from "../../../../components/DataTable";
import { DsrActions } from "../../../../components/DsrActions";

const queue = [
  { id: "dsr-1", subject: "Jane Doe", received: "2024-09-01", status: "waiting" },
  { id: "dsr-2", subject: "John Smith", received: "2024-09-03", status: "acknowledged" },
];

export default async function DsrPage() {
  const t = await getTranslations({ namespace: "dsr" });

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold text-gray-900">{t("heading")}</h2>
        <p className="text-sm text-gray-600">{t("subheading")}</p>
      </header>
      <DsrActions />
      <DataTable
        columns={[
          { key: "subject", header: t("columns.subject") },
          { key: "received", header: t("columns.received") },
          { key: "status", header: t("columns.status") }
        ]}
        data={queue}
        caption={t("tableCaption")}
        emptyState={t("empty")}
      />
    </section>
  );
}
