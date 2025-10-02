import { notFound } from "next/navigation";
import { Timeline } from "@airnub/ui";
import { getDemoRun } from "../../../../../lib/demo-data";
import { EvidencePanel } from "../../../../../components/evidence-panel";
import { AuditLog } from "../../../../../components/audit-log";

export default async function WorkflowRunPage({ params }: { params: { id: string } }) {
  const run = await getDemoRun();
  if (params.id !== run.id) {
    notFound();
  }

  const evidenceItems = (run.timeline[0].verifyRules ?? []).map((rule) => ({
    id: rule.id,
    title: rule.name,
    sources: rule.sources.map((url) => ({ label: url, url })),
    lastVerifiedAt: rule.lastVerifiedAt
  }));

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded border bg-white p-6 shadow">
        <h2 className="text-2xl font-semibold">{run.title}</h2>
        <p className="text-sm text-muted-foreground">Timeline view with phases, due dates, and assignments.</p>
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

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded border bg-white p-6 shadow">
          <h3 className="font-semibold">Evidence & rule verification</h3>
          <p className="text-sm text-muted-foreground">
            Review source links and refresh freshness checks as required.
          </p>
          <div className="mt-4">
            <EvidencePanel initialItems={evidenceItems} />
          </div>
        </div>
        <div className="space-y-6">
          <AuditLog entries={run.audit} />
          <div className="rounded border bg-white p-3">
            <h3 className="font-semibold">Documents</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {run.documents.map((doc) => (
                <li key={doc.title}>
                  <a
                    href={`data:text/markdown;charset=utf-8,${encodeURIComponent(doc.content)}`}
                    download={doc.title}
                  >
                    Download {doc.title} (checksum {doc.checksum})
                  </a>
                  <div>
                    <a href={`data:application/pdf;base64,${doc.pdfBase64}`} download={doc.title.replace(/\.md$/, ".pdf")}>
                      Download PDF copy
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
