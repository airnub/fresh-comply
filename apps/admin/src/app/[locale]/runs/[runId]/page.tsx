import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { DiffViewer } from "../../../../../components/DiffViewer";
import { RunActionsPanel } from "../../../../../components/RunActionsPanel";

export default async function RunInspectorPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  if (!runId) {
    notFound();
  }

  const t = await getTranslations({ namespace: "runs" });

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold text-gray-900">{t("heading", { runId })}</h2>
        <p className="text-sm text-gray-600">{t("subheading")}</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <article className="space-y-4">
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t("overview")}</h3>
            <dl className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-gray-500">{t("fields.status")}</dt>
                <dd>active</dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-500">{t("fields.owner")}</dt>
                <dd>compliance_moderator@freshcomply.dev</dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-500">{t("fields.dueDate")}</dt>
                <dd>2024-09-22</dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-500">{t("fields.mode")}</dt>
                <dd>manual</dd>
              </div>
            </dl>
          </section>
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t("timeline")}</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              <li>2024-09-01 — Run created</li>
              <li>2024-09-05 — Initial documents shared</li>
              <li>2024-09-06 — Awaiting manual evidence review</li>
            </ul>
          </section>
          <DiffViewer before="status: awaiting_review
assignee: Alex" after="status: in_progress
assignee: Jamie" heading={t("diffHeading")} />
        </article>
        <aside className="space-y-4">
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t("actions")}</h3>
            <RunActionsPanel runId={runId} />
          </section>
        </aside>
      </div>
    </section>
  );
}
