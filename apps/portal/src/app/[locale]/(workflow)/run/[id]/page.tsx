import { notFound } from "next/navigation";
import { Timeline } from "@airnub/ui";
import { getTranslations } from "next-intl/server";
import { Card, Flex, Grid, Heading, Link as ThemeLink, Text } from "@radix-ui/themes";
import { getDemoRun } from "../../../../../lib/demo-data";
import { EvidencePanel } from "../../../../../components/evidence-panel";
import { AuditLog } from "../../../../../components/audit-log";
import { StepOrchestrationPanel } from "../../../../../components/step-orchestration-panel";

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

  const evidenceRules = run.timeline.flatMap((step) => step.verifyRules ?? []);

  return (
    <Flex direction="column" gap="6">
      <Card asChild variant="surface" size="3">
        <section aria-labelledby="workflow-timeline-heading">
          <Flex direction="column" gap="3">
            <Heading id="workflow-timeline-heading" size="5">
              {tWorkflow("timelineHeading")}
            </Heading>
            <Text size="2" color="gray">
              {tWorkflow("timelineDescription")}
            </Text>
            <Timeline
              items={run.timeline.map((step) => ({
                id: step.id,
                title: step.title,
                status: step.status,
                dueDate: step.dueDate,
                assignee: step.assignee,
                executionMode: step.execution?.mode,
                orchestrationStatus: step.orchestration?.status,
                orchestrationResult: step.orchestration?.resultSummary,
                freshness: step.freshness
              }))}
            />
          </Flex>
        </section>
      </Card>

      <Card asChild variant="surface" size="3">
        <section aria-labelledby="workflow-orchestration-heading">
          <Flex direction="column" gap="3">
            <Heading id="workflow-orchestration-heading" size="5">
              {tWorkflow("orchestrationHeading")}
            </Heading>
            <Text size="2" color="gray">
              {tWorkflow("orchestrationDescription")}
            </Text>
            <Flex direction="column" gap="4">
              {run.timeline.map((step) => (
                <StepOrchestrationPanel key={step.id} step={step} runId={run.id} orgId={run.client} />
              ))}
            </Flex>
          </Flex>
        </section>
      </Card>

      <Grid columns={{ initial: "1", md: "2" }} gap="4">
        <Card asChild variant="surface" size="3">
          <section aria-labelledby="workflow-evidence-heading">
            <Flex direction="column" gap="3">
              <Heading id="workflow-evidence-heading" size="4">
                {tWorkflow("evidenceHeading")}
              </Heading>
              <Text size="2" color="gray">
                {tWorkflow("evidenceDescription")}
              </Text>
              <EvidencePanel initialRules={evidenceRules} />
            </Flex>
          </section>
        </Card>
        <Flex direction="column" gap="4">
          <AuditLog entries={run.audit} />
          <Card asChild variant="surface" size="2">
            <section aria-labelledby="workflow-documents-heading">
              <Flex direction="column" gap="3">
                <Heading id="workflow-documents-heading" size="4">
                  {tWorkflow("documentsHeading")}
                </Heading>
                <Flex asChild direction="column" gap="2">
                  <ul>
                    {run.documents.map((doc) => (
                      <li key={doc.title}>
                        <Flex direction="column" gap="1">
                          <ThemeLink
                            href={`data:text/markdown;charset=utf-8,${encodeURIComponent(doc.content)}`}
                            download={doc.title}
                            rel="noopener"
                            underline="always"
                          >
                            {tWorkflow("downloadMarkdown", { title: doc.title })}
                          </ThemeLink>
                          <ThemeLink
                            href={`data:application/pdf;base64,${doc.pdfBase64}`}
                            download={doc.title.replace(/\.md$/, ".pdf")}
                            rel="noopener"
                            underline="always"
                          >
                            {tWorkflow("downloadPdf")}
                          </ThemeLink>
                        </Flex>
                      </li>
                    ))}
                  </ul>
                </Flex>
              </Flex>
            </section>
          </Card>
        </Flex>
      </Grid>
    </Flex>
  );
}
