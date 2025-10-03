"use client";

import { useState } from "react";
import { Button, Callout, Flex, Separator, Text, TextField } from "@radix-ui/themes";
import { CheckCircledIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { useTranslations } from "next-intl";
import type { DemoStep } from "../lib/demo-data";

function buildPayload(step: DemoStep) {
  switch (step.id) {
    case "cro-name-check":
      return { proposedName: "Fresh Example CLG" };
    case "cro-a1-pack":
      return {
        orgName: "Company X (Client)",
        meetingDate: new Date().toISOString().split("T")[0],
        meetingTime: "09:30",
        meetingLocation: "FreshComply HQ"
      };
    case "revenue-tr2":
      return {
        payload: {
          type: "TR2",
          orgName: "Company X (Client)",
          contactEmail: "advisor@example.ie"
        }
      };
    case "revenue-etax-clearance":
      return { taxReference: "1234567A" };
    default:
      return {};
  }
}

export function StepOrchestrationPanel({ step, runId, orgId }: { step: DemoStep; runId: string; orgId: string }) {
  const t = useTranslations("workflow");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState("");

  const executionMode = step.execution?.mode;
  const isTemporal = executionMode === "temporal" || executionMode === "external:websocket";
  const isWebhook = executionMode === "external:webhook";
  const workflowName = (() => {
    if (!step.execution) {
      return "croNameCheckWorkflow";
    }
    if (step.execution.mode === "temporal") {
      return (
        step.execution.workflow ||
        step.execution.config?.workflow ||
        "croNameCheckWorkflow"
      );
    }
    if (step.execution.mode === "external:websocket") {
      return step.execution.config.temporalWorkflow || "externalJobWorkflow";
    }
    return "croNameCheckWorkflow";
  })();

  async function handleStart() {
    setIsLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/orchestration/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          runId,
          stepKey: step.id,
          workflow: workflowName,
          input: buildPayload(step)
        })
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? "Failed to start workflow");
      }
      setMessage(t("orchestrationStartSuccess", { workflowId: json.workflowId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("orchestrationUnknownError"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleInvokeWebhook() {
    if (!isWebhook || !step.execution || step.execution.mode !== "external:webhook") {
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/orchestration/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: orgId,
          orgId,
          runId,
          stepKey: step.id,
          request: step.execution.config,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? t("orchestrationWebhookError"));
      }
      setMessage(t("orchestrationWebhookSuccess", { status: json.status }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("orchestrationWebhookError"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignal() {
    setIsLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/orchestration/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: `demo-${step.id}`,
          signal: "confirmManualFiling",
          payload: { receiptUrl: receiptUrl || undefined }
        })
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? "Failed to signal workflow");
      }
      setMessage(t("orchestrationSignalSuccess"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("orchestrationUnknownError"));
    } finally {
      setIsLoading(false);
    }
  }

  function handleManualComplete() {
    setMessage(t("orchestrationManualComplete"));
  }

  return (
    <Flex direction="column" gap="3">
      <Flex direction="column" gap="1">
        <Text as="h3" size="3" weight="medium">
          {step.title}
        </Text>
        <Text as="p" size="2" color="gray">
          {isTemporal
            ? step.orchestration?.resultSummary ?? t("orchestrationTemporalHint")
            : isWebhook
              ? step.orchestration?.resultSummary ?? t("orchestrationWebhookHint")
              : t("orchestrationManualHint")}
        </Text>
      </Flex>
      {isTemporal ? (
        <Flex direction="column" gap="2">
          <Flex gap="2" wrap="wrap">
            <Button onClick={handleStart} loading={isLoading} disabled={isLoading}>
              {step.orchestration?.status === "completed"
                ? t("orchestrationRetry")
                : t("orchestrationStart")}
            </Button>
            <Button
              onClick={handleSignal}
              loading={isLoading}
              disabled={isLoading}
              variant="soft"
              color="blue"
            >
              {t("orchestrationSignal")}
            </Button>
          </Flex>
          <TextField.Root
            placeholder={t("orchestrationReceiptPlaceholder")}
            value={receiptUrl}
            onChange={(event) => setReceiptUrl(event.target.value)}
            aria-label={t("orchestrationReceiptLabel")}
          />
        </Flex>
      ) : isWebhook ? (
        <Button onClick={handleInvokeWebhook} loading={isLoading} disabled={isLoading}>
          {t("orchestrationWebhookButton")}
        </Button>
      ) : (
        <Button onClick={handleManualComplete} variant="surface" color="gray">
          {t("orchestrationManualButton")}
        </Button>
      )}
      {(message || error) && (
        <Callout.Root color={error ? "red" : "green"}>
          <Callout.Icon>
            {error ? <ExclamationTriangleIcon /> : <CheckCircledIcon />}
          </Callout.Icon>
          <Callout.Text>{error ?? message}</Callout.Text>
        </Callout.Root>
      )}
      <Separator my="2" size="4" />
    </Flex>
  );
}
