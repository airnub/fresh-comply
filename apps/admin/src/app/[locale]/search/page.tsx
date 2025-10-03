import { getTranslations } from "next-intl/server";
import { DataTable } from "../../../../components/DataTable";

type SearchRow = {
  id: string;
  type: string;
  name: string;
  status: string;
};

const sampleResults: SearchRow[] = [
  { id: "run_123", type: "run", name: "GDPR onboarding", status: "active" },
  { id: "case_42", type: "case", name: "Support request", status: "waiting" },
  { id: "org_acme", type: "org", name: "Acme Ltd", status: "verified" }
];

export default async function SearchPage() {
  const t = await getTranslations({ namespace: "search" });

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold text-gray-900">{t("heading")}</h2>
        <p className="text-sm text-gray-600">{t("subheading")}</p>
      </header>
      <form className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto]">
        <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
          {t("label")}
          <input
            type="search"
            name="q"
            placeholder={t("placeholder")}
            className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <button
          type="submit"
          className="self-end rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {t("submit")}
        </button>
      </form>
      <DataTable
        columns={[
          { key: "type", header: t("columns.type") },
          { key: "name", header: t("columns.name") },
          { key: "status", header: t("columns.status") }
        ]}
        data={sampleResults}
        caption={t("tableCaption")}
        emptyState={t("empty")}
      />
    </section>
  );
}
