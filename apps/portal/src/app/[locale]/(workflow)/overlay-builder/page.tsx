import path from "node:path";
import { getTranslations } from "next-intl/server";
import { loadDSL } from "@airnub/engine/dsl";
import { materializeWorkflow } from "@airnub/engine/engine";
import { TenantOverlayBuilder } from "../../../../components/tenant-overlay-builder";

export default async function OverlayBuilderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "overlayBuilder" });

  const workflowPath = path.join(
    process.cwd(),
    "packages",
    "workflows",
    "ie-nonprofit-clg-charity.yaml"
  );
  const dsl = loadDSL(workflowPath);
  const materialized = materializeWorkflow(dsl);

  const baseWorkflow = {
    id: dsl.id,
    version: dsl.version,
    title: dsl.title,
    steps: materialized.steps.map((step) => ({
      id: step.id,
      title: step.title,
      kind: step.kind,
      required: step.required,
      stepType: step.stepType,
    })),
  };

  const stepTypes = [
    {
      slug: "manual.review",
      version: "2.1.0",
      title: t("stepTypes.manualReview.title"),
      summary: t("stepTypes.manualReview.summary"),
      kind: "review",
      executionMode: "manual" as const,
      defaultInput: {
        checklist: ["evidence", "notes"],
      },
      secretAliases: [],
    },
    {
      slug: "temporal.webhook",
      version: "1.4.0",
      title: t("stepTypes.temporalWebhook.title"),
      summary: t("stepTypes.temporalWebhook.summary"),
      kind: "tool.call",
      executionMode: "temporal" as const,
      defaultInput: {
        urlAlias: "secrets.crm.apiToken",
        retryPolicy: { attempts: 3 },
      },
      secretAliases: ["secrets.crm.apiToken", "secrets.temporal.taskQueueKey"],
    },
  ];

  const secrets = [
    {
      alias: "secrets.crm.apiToken",
      description: t("secrets.crmApiToken"),
    },
    {
      alias: "secrets.temporal.taskQueueKey",
      description: t("secrets.temporalQueue"),
    },
  ];

  const labels = {
    heading: t("heading"),
    description: t("description"),
    baseHeading: t("base.heading"),
    baseHint: t("base.hint"),
    addHeading: t("add.heading"),
    addHint: t("add.hint"),
    stepTypeLabel: t("add.stepType"),
    inputLabel: t("add.input"),
    inputPlaceholder: t("add.inputPlaceholder"),
    secretLabel: t("add.secret"),
    secretPlaceholder: t("add.secretPlaceholder"),
    insertButton: t("actions.insert"),
    resetButton: t("actions.reset"),
    operationsHeading: t("operations.heading"),
    overlayHeading: t("overlay.heading"),
    overlayHint: t("overlay.hint"),
    persistButton: t("actions.persist"),
    persistSuccess: t("messages.persistSuccess"),
    persistError: t("messages.persistError"),
    mergeError: t("messages.mergeError"),
    secretRequired: t("messages.secretRequired"),
    secretUnavailable: t("messages.secretUnavailable"),
    addedLabel: t("overlay.added"),
    removedLabel: t("overlay.removed"),
    totalLabel: t("base.optional"),
    overlayCount: (count: number) => t("overlay.count", { count }),
  } as const;

  return (
    <TenantOverlayBuilder
      baseWorkflow={baseWorkflow}
      stepTypes={stepTypes}
      secrets={secrets}
      tenantId="tenant-company-x"
      labels={labels}
    />
  );
}
