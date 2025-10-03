import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

export default async function TemporalPanelPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  if (!runId) {
    notFound();
  }

  const t = await getTranslations({ namespace: "temporal" });

  const activities = [
    { id: 1, name: "generateDocument", status: "completed", at: "2024-09-06T12:01:00Z" },
    { id: 2, name: "notifyStakeholders", status: "pending", at: "2024-09-06T12:10:00Z" }
  ];

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold text-gray-900">{t("heading", { runId })}</h2>
        <p className="text-sm text-gray-600">{t("subheading")}</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <article className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t("recentActivities")}</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            {activities.map((activity) => (
              <li key={activity.id} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
                <span className="font-medium text-gray-900">{activity.name}</span>
                <span className="text-xs uppercase tracking-wide text-gray-500">{activity.status}</span>
              </li>
            ))}
          </ul>
        </article>
        <aside className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t("actions")}</h3>
          <div className="space-y-2">
            <button className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              {t("sendSignal")}
            </button>
            <button className="w-full rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400">
              {t("retryLast")}
            </button>
            <button className="w-full rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
              {t("cancelWorkflow")}
            </button>
          </div>
          <p className="text-xs text-gray-500">{t("securityNote")}</p>
        </aside>
      </div>
    </section>
  );
}
