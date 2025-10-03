import { getTranslations } from "next-intl/server";
import Link from "next/link";

const runs = [
  { id: "run-123", status: "active", owner: "Alex" },
  { id: "run-456", status: "waiting", owner: "Jamie" },
];

export default async function RunsIndexPage() {
  const t = await getTranslations({ namespace: "runs" });

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold text-gray-900">{t("listHeading", { count: runs.length })}</h2>
        <p className="text-sm text-gray-600">{t("listSubheading")}</p>
      </header>
      <ul className="space-y-2">
        {runs.map((run) => (
          <li key={run.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{run.id}</p>
                <p className="text-xs text-gray-500">{t("fields.owner")}: {run.owner}</p>
              </div>
              <Link
                href={`./${run.id}`}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {t("viewRun")}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
