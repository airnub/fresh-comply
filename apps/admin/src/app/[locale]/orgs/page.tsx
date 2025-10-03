import { getTranslations } from "next-intl/server";
import { DataTable } from "../../../../components/DataTable";

const orgs = [
  { id: "org-1", name: "Acme Ltd", type: "controller", engagements: 3 },
  { id: "org-2", name: "Bright LLP", type: "processor", engagements: 2 },
];

export default async function OrgsPage() {
  const t = await getTranslations({ namespace: "orgs" });

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold text-gray-900">{t("heading")}</h2>
        <p className="text-sm text-gray-600">{t("subheading")}</p>
      </header>
      <div className="flex flex-wrap gap-3">
        <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          {t("actions.addOrg")}
        </button>
        <button className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400">
          {t("actions.inviteUser")}
        </button>
      </div>
      <DataTable
        columns={[
          { key: "name", header: t("columns.name") },
          { key: "type", header: t("columns.type") },
          { key: "engagements", header: t("columns.engagements") }
        ]}
        data={orgs}
        caption={t("tableCaption")}
        emptyState={t("empty")}
      />
    </section>
  );
}
