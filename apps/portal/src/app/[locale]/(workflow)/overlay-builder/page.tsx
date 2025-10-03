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
      execution: { mode: "manual" as const },
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
      execution: {
        mode: "temporal" as const,
        workflow: "croNameCheckWorkflow",
        defaultTaskQueue: "fc-standard",
        config: {
          workflow: "croNameCheckWorkflow",
          defaultTaskQueue: "fc-standard",
        },
      },
      defaultInput: {
        retryPolicy: { attempts: 3 },
      },
      secretAliases: ["secrets.crm.apiToken", "secrets.temporal.taskQueueKey"],
    },
    {
      slug: "external.crm.webhook",
      version: "1.0.0",
      title: t("stepTypes.externalWebhook.title"),
      summary: t("stepTypes.externalWebhook.summary"),
      kind: "action",
      execution: {
        mode: "external:webhook" as const,
        config: {
          method: "POST",
          urlAlias: "secrets.webhooks.baseUrl",
          tokenAlias: "secrets.webhooks.token",
          path: "/integrations/fresh-comply",
        },
      },
      defaultInput: {
        payloadTemplate: { status: "pending" },
      },
      secretAliases: ["secrets.webhooks.baseUrl", "secrets.webhooks.token", "secrets.webhooks.signature"],
      executionAliasOptions: {
        urlAlias: ["secrets.webhooks.baseUrl"],
        tokenAlias: ["secrets.webhooks.token"],
        "signing.secretAlias": ["secrets.webhooks.signature"],
      },
    },
    {
      slug: "external.stream.websocket",
      version: "0.3.0",
      title: t("stepTypes.externalWebsocket.title"),
      summary: t("stepTypes.externalWebsocket.summary"),
      kind: "tool.call",
      execution: {
        mode: "external:websocket" as const,
        config: {
          urlAlias: "secrets.websocket.baseUrl",
          tokenAlias: "secrets.websocket.token",
          messageSchema: "schemas/stream-message.json",
          temporalWorkflow: "externalJobWorkflow",
          defaultTaskQueue: "tenant-x-events",
        },
      },
      defaultInput: {},
      secretAliases: ["secrets.websocket.baseUrl", "secrets.websocket.token"],
      executionAliasOptions: {
        urlAlias: ["secrets.websocket.baseUrl"],
        tokenAlias: ["secrets.websocket.token"],
      },
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
    {
      alias: "secrets.webhooks.baseUrl",
      description: t("secrets.webhookBaseUrl"),
    },
    {
      alias: "secrets.webhooks.token",
      description: t("secrets.webhookToken"),
    },
    {
      alias: "secrets.webhooks.signature",
      description: t("secrets.webhookSignature"),
    },
    {
      alias: "secrets.websocket.baseUrl",
      description: t("secrets.websocketUrl"),
    },
    {
      alias: "secrets.websocket.token",
      description: t("secrets.websocketToken"),
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
    executionLabel: t("add.executionLabel"),
    executionHint: t("add.executionHint"),
    executionWebhookMethod: t("add.executionWebhookMethod"),
    executionWebhookUrlAlias: t("add.executionWebhookUrlAlias"),
    executionWebhookTokenAlias: t("add.executionWebhookTokenAlias"),
    executionWebhookPath: t("add.executionWebhookPath"),
    executionWebhookSigningAlias: t("add.executionWebhookSigningAlias"),
    executionTemporalWorkflow: t("add.executionTemporalWorkflow"),
    executionTemporalTaskQueue: t("add.executionTemporalTaskQueue"),
    executionTemporalDefaultTaskQueue: t("add.executionTemporalDefaultTaskQueue"),
    executionWebsocketUrlAlias: t("add.executionWebsocketUrlAlias"),
    executionWebsocketTokenAlias: t("add.executionWebsocketTokenAlias"),
    executionWebsocketMessageSchema: t("add.executionWebsocketMessageSchema"),
    executionWebsocketWorkflow: t("add.executionWebsocketWorkflow"),
    executionWebsocketQueue: t("add.executionWebsocketQueue"),
    executionAliasUnavailable: t("messages.executionAliasUnavailable"),
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
    executionWebhookUrlAliasRequired: t("messages.executionWebhookUrlAliasRequired"),
    executionWebsocketUrlAliasRequired: t("messages.executionWebsocketUrlAliasRequired"),
    executionAliasInvalid: t("messages.executionAliasInvalid"),
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
