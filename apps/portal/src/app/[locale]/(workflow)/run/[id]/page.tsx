import { notFound } from "next/navigation";
import { Timeline } from "@airnub/ui";
import { getTranslations } from "next-intl/server";
import { getDemoRun } from "../../../../../lib/demo-data";
import { EvidencePanel } from "../../../../../components/evidence-panel";
import { AuditLog } from "../../../../../components/audit-log";

export default async function WorkflowRunPage({
  params
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const run = await getDemoRun();
  if (id !== run.id) {
    notFound();
  }

  const tWorkflow = await getTranslations({ locale, namespace: "workflow" });

  const evidenceItems = (run.timeline[0].verifyRules ?? []).map((rule) => ({
    id: rule.id,
    title: rule.name,
    sources: rule.sources.map((url) => ({ label: url, url })),
    lastVerifiedAt: rule.lastVerifiedAt
  }));

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded border border-subtle bg-surface p-6 shadow">
        <h2 className="text-2xl font-semibold text-foreground">{tWorkflow("timelineHeading")}</h2>
        <p className="text-sm text-muted-foreground">{tWorkflow("timelineDescription")}</p>
        <div className="mt-4">
          <Timeline
            items={run.timeline.map((step) => ({
              id: step.id,
              title: step.title,
              status: step.status,
              dueDate: step.dueDate,
              assignee: step.assignee
            }))}
          />
        </div>
      </section>

      <section className="grid-two">
        <div className="rounded border border-subtle bg-surface p-6 shadow">
          <h3 className="text-base font-semibold text-foreground">{tWorkflow("evidenceHeading")}</h3>
          <p className="text-sm text-muted-foreground">{tWorkflow("evidenceDescription")}</p>
          <div className="mt-4">
            <EvidencePanel initialItems={evidenceItems} />
          </div>
        </div>
        <div className="space-y-6">
          <AuditLog entries={run.audit} />
          <div className="rounded border border-subtle bg-surface p-3 shadow">
            <h3 className="text-base font-semibold text-foreground">{tWorkflow("documentsHeading")}</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {run.documents.map((doc) => (
                <li key={doc.title}>
                  <a
                    className="underline"
                    href={`data:text/markdown;charset=utf-8,${encodeURIComponent(doc.content)}`}
                    download={doc.title}
                    rel="noopener"
                  >
                    {tWorkflow("downloadMarkdown", { title: doc.title })}
                  </a>
                  <div>
                    <a
                      className="underline"
                      href={`data:application/pdf;base64,${doc.pdfBase64}`}
                      download={doc.title.replace(/\.md$/, ".pdf")}
                      rel="noopener"
                    >
                      {tWorkflow("downloadPdf")}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
