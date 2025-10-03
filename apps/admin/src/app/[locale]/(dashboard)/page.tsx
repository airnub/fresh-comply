import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
  const t = await getTranslations({ namespace: "dashboard" });

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold text-gray-900">{t("heading")}</h2>
        <p className="text-sm text-gray-600">{t("subheading")}</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("metrics.activeRuns")}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">42</p>
          <p className="text-xs text-gray-500">{t("metrics.activeRunsHint")}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("metrics.awaitingApproval")}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">7</p>
          <p className="text-xs text-gray-500">{t("metrics.awaitingApprovalHint")}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("metrics.dsrSla")}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">98%</p>
          <p className="text-xs text-gray-500">{t("metrics.dsrSlaHint")}</p>
        </div>
      </div>
    </section>
  );
}
