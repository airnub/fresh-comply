"use client";

import { useEffect, useMemo, useState } from "react";
import { applyPatch, type Operation } from "fast-json-patch";
import {
  Button,
  Card,
  Callout,
  Flex,
  Grid,
  Heading,
  Select,
  Separator,
  Text,
  TextArea
} from "@radix-ui/themes";

export type OverlayStepType = {
  slug: string;
  version: string;
  title: string;
  summary: string;
  kind: string;
  executionMode: "manual" | "temporal";
  defaultInput: Record<string, unknown>;
  secretAliases: string[];
};

export type OverlaySecretBinding = {
  alias: string;
  description: string;
};

export type OverlayWorkflow = {
  id: string;
  version: string;
  title?: string;
  steps: Array<{
    id: string;
    title: string;
    kind: string;
    required?: boolean;
    stepType?: string;
  }>;
};

export interface OverlayBuilderLabels {
  heading: string;
  description: string;
  baseHeading: string;
  baseHint: string;
  addHeading: string;
  addHint: string;
  stepTypeLabel: string;
  inputLabel: string;
  inputPlaceholder: string;
  secretLabel: string;
  secretPlaceholder: string;
  insertButton: string;
  resetButton: string;
  operationsHeading: string;
  overlayHeading: string;
  overlayHint: string;
  persistButton: string;
  persistSuccess: string;
  persistError: string;
  mergeError: string;
  secretRequired: string;
  secretUnavailable: string;
  addedLabel: string;
  removedLabel: string;
  totalLabel: string;
  overlayCount: (count: number) => string;
}

export interface TenantOverlayBuilderProps {
  baseWorkflow: OverlayWorkflow;
  stepTypes: OverlayStepType[];
  secrets: OverlaySecretBinding[];
  tenantId: string;
  labels: OverlayBuilderLabels;
}

export function TenantOverlayBuilder({
  baseWorkflow,
  stepTypes,
  secrets,
  tenantId,
  labels
}: TenantOverlayBuilderProps) {
  const [selectedStepType, setSelectedStepType] = useState(() =>
    stepTypes.length > 0 ? `${stepTypes[0].slug}@${stepTypes[0].version}` : ""
  );
  const [inputJson, setInputJson] = useState(() =>
    JSON.stringify(stepTypes[0]?.defaultInput ?? {}, null, 2)
  );
  const [selectedSecret, setSelectedSecret] = useState<string>(
    secrets[0]?.alias ?? ""
  );
  const [inputError, setInputError] = useState<string | null>(null);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [overlayOperations, setOverlayOperations] = useState<Operation[]>([]);
  const [persistMessage, setPersistMessage] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const mergeResult = useMemo(() => {
    try {
      const result = applyPatch(structuredClone(baseWorkflow), overlayOperations, true, false);
      return {
        workflow: (result.newDocument as OverlayWorkflow) ?? baseWorkflow,
        error: null as string | null
      };
    } catch (error) {
      return { workflow: baseWorkflow, error: (error as Error).message };
    }
  }, [baseWorkflow, overlayOperations]);

  const mergedWorkflow = mergeResult.workflow;
  const mergeError = mergeResult.error;

  const impact = useMemo(() => {
    const baseIds = new Set(baseWorkflow.steps.map((step) => step.id));
    const mergedIds = new Set(mergedWorkflow.steps.map((step) => step.id));
    const added = Array.from(mergedIds).filter((id) => !baseIds.has(id));
    const removed = Array.from(baseIds).filter((id) => !mergedIds.has(id));
    return { added, removed };
  }, [baseWorkflow.steps, mergedWorkflow.steps]);

  const overlayJson = useMemo(
    () => JSON.stringify(overlayOperations, null, 2),
    [overlayOperations]
  );

  const activeStepType = useMemo(() => {
    const [slug, version] = selectedStepType.split("@");
    return stepTypes.find(
      (candidate) => candidate.slug === slug && candidate.version === version
    );
  }, [selectedStepType, stepTypes]);

  const availableSecrets = useMemo(() => {
    if (!activeStepType || activeStepType.secretAliases.length === 0) {
      return secrets;
    }
    return secrets.filter((secret) =>
      activeStepType.secretAliases.includes(secret.alias)
    );
  }, [activeStepType, secrets]);

  useEffect(() => {
    if (!activeStepType) {
      setSecretError(null);
      return;
    }

    if (activeStepType.secretAliases.length === 0) {
      if (selectedSecret) {
        setSelectedSecret("");
      }
      setSecretError(null);
      return;
    }

    if (availableSecrets.length === 0) {
      if (selectedSecret) {
        setSelectedSecret("");
      }
      setSecretError(labels.secretUnavailable);
      return;
    }

    const hasValidSelection = availableSecrets.some(
      (secret) => secret.alias === selectedSecret
    );

    if (!hasValidSelection) {
      const fallback = availableSecrets[0]?.alias ?? "";
      setSelectedSecret(fallback);
    }

    setSecretError(null);
  }, [activeStepType, availableSecrets, labels.secretUnavailable, selectedSecret]);

  const handleSecretChange = (value: string) => {
    setSelectedSecret(value);
    setSecretError(null);
  };

  const handleInsertStep = () => {
    if (!selectedStepType) {
      return;
    }
    const [slug, version] = selectedStepType.split("@");
    const stepType = stepTypes.find(
      (candidate) => candidate.slug === slug && candidate.version === version
    );
    if (!stepType) {
      return;
    }

    if (
      stepType.secretAliases.length > 0 &&
      (!selectedSecret || !stepType.secretAliases.includes(selectedSecret))
    ) {
      setSecretError(
        availableSecrets.length === 0
          ? labels.secretUnavailable
          : labels.secretRequired
      );
      return;
    }

    let parsedInput: Record<string, unknown> = {};
    if (inputJson.trim().length > 0) {
      try {
        parsedInput = JSON.parse(inputJson);
        setInputError(null);
      } catch (error) {
        setInputError((error as Error).message);
        return;
      }
    } else {
      setInputError(null);
    }

    const timestamp = Date.now();
    const stepId = `${slug}-${version}-${timestamp}`;
    const secretsMetadata = selectedSecret
      ? { secrets: { primary: { alias: selectedSecret } } }
      : undefined;

    const operation: Operation = {
      op: "add",
      path: "/steps/-",
      value: {
        id: stepId,
        kind: stepType.kind,
        title: stepType.title,
        stepType: `${slug}@${version}`,
        execution: {
          mode: stepType.executionMode,
        },
        input: parsedInput,
        metadata: secretsMetadata,
      },
    };

    setOverlayOperations((prev) => [...prev, operation]);
    setSecretError(null);
    setPersistMessage(null);
    setPersistError(null);
  };

  const handleReset = () => {
    setOverlayOperations([]);
    setPersistMessage(null);
    setPersistError(null);
    setSecretError(null);
  };

  const handlePersist = async () => {
    if (mergeError) {
      setPersistMessage(null);
      setPersistError(`${labels.mergeError}: ${mergeError}`);
      return;
    }

    setIsSaving(true);
    setPersistMessage(null);
    setPersistError(null);
    try {
      const response = await fetch("/api/overlays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          workflowId: baseWorkflow.id,
          overlay: overlayOperations,
          mergedWorkflow,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? labels.persistError);
      }
      setPersistMessage(labels.persistSuccess);
    } catch (error) {
      setPersistError((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const stepTypeItems = stepTypes.map((type) => ({
    value: `${type.slug}@${type.version}`,
    label: `${type.title} (${type.version})`,
  }));

  return (
    <Flex direction="column" gap="5">
      <Card variant="surface">
        <Flex direction="column" gap="3">
          <Heading size="6">{labels.heading}</Heading>
          <Text size="3" color="gray">
            {labels.description}
          </Text>
        </Flex>
      </Card>

      <Grid columns={{ initial: "1", md: "2" }} gap="4">
        <Card variant="surface">
          <Flex direction="column" gap="3">
            <Heading size="5">{labels.baseHeading}</Heading>
            <Text size="2" color="gray">
              {labels.baseHint}
            </Text>
            <Separator my="2" size="4" />
            <Flex direction="column" gap="2">
              {baseWorkflow.steps.map((step) => (
                <Flex key={step.id} direction="column" gap="1" className="rounded-md border border-gray-200 p-3">
                  <Text size="3" weight="medium">
                    {step.title}
                  </Text>
                  <Text size="2" color="gray">
                    {step.stepType ?? step.kind}
                  </Text>
                  <Text size="1" color="gray">
                    {step.required ? labels.addedLabel : labels.totalLabel}
                  </Text>
                </Flex>
              ))}
            </Flex>
          </Flex>
        </Card>

        <Card variant="surface">
          <Flex direction="column" gap="4">
            <header>
              <Heading size="5">{labels.addHeading}</Heading>
              <Text size="2" color="gray">{labels.addHint}</Text>
            </header>
            <Flex direction="column" gap="3">
              <label className="space-y-2">
                <Text size="2" weight="medium">
                  {labels.stepTypeLabel}
                </Text>
                <Select.Root value={selectedStepType} onValueChange={setSelectedStepType}>
                  <Select.Trigger className="w-full" />
                  <Select.Content>
                    {stepTypeItems.map((item) => (
                      <Select.Item key={item.value} value={item.value}>
                        {item.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
                {activeStepType ? (
                  <Text size="1" color="gray">
                    {activeStepType.summary}
                  </Text>
                ) : null}
              </label>

              <label className="space-y-2">
                <Text size="2" weight="medium">
                  {labels.inputLabel}
                </Text>
                <TextArea
                  value={inputJson}
                  onChange={(event) => setInputJson(event.target.value)}
                  rows={6}
                  placeholder={labels.inputPlaceholder}
                />
                {inputError ? (
                  <Text size="1" color="red">
                    {inputError}
                  </Text>
                ) : null}
              </label>

              <label className="space-y-2">
                <Text size="2" weight="medium">
                  {labels.secretLabel}
                </Text>
                <Select.Root
                  value={selectedSecret}
                  onValueChange={handleSecretChange}
                >
                  <Select.Trigger
                    className="w-full"
                    placeholder={labels.secretPlaceholder}
                    disabled={
                      !!activeStepType &&
                      activeStepType.secretAliases.length > 0 &&
                      availableSecrets.length === 0
                    }
                  />
                  <Select.Content>
                    <Select.Item
                      value=""
                      disabled={
                        !!activeStepType && activeStepType.secretAliases.length > 0
                      }
                    >
                      {labels.secretPlaceholder}
                    </Select.Item>
                    {availableSecrets.map((secret) => (
                      <Select.Item key={secret.alias} value={secret.alias}>
                        {secret.alias}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
                {secretError ? (
                  <Text size="1" color="red">{secretError}</Text>
                ) : selectedSecret ? (
                  <Text size="1" color="gray">
                    {secrets.find((secret) => secret.alias === selectedSecret)?.description}
                  </Text>
                ) : null}
              </label>

              <Flex gap="3" wrap="wrap">
                <Button onClick={handleInsertStep}>{labels.insertButton}</Button>
                <Button variant="soft" color="gray" onClick={handleReset} disabled={overlayOperations.length === 0}>
                  {labels.resetButton}
                </Button>
              </Flex>
            </Flex>
          </Flex>
        </Card>
      </Grid>

      <Card variant="surface">
        <Flex direction="column" gap="3">
          <Heading size="5">{labels.operationsHeading}</Heading>
          <TextArea value={overlayJson} rows={12} readOnly />
        </Flex>
      </Card>

      <Card variant="surface">
        <Flex direction="column" gap="3">
          <Heading size="5">{labels.overlayHeading}</Heading>
          <Text size="2" color="gray">
            {labels.overlayHint}
          </Text>
          <Text size="2" weight="medium">
            {labels.overlayCount(overlayOperations.length)}
          </Text>
          {mergeError ? (
            <Callout.Root color="red">
              <Callout.Text>{labels.mergeError}: {mergeError}</Callout.Text>
            </Callout.Root>
          ) : null}
          <Grid columns={{ initial: "1", md: "2" }} gap="3">
            <Card variant="classic">
              <Flex direction="column" gap="2">
                <Text size="2" weight="medium">
                  {labels.addedLabel}
                </Text>
                {impact.added.length === 0 ? (
                  <Text size="1" color="gray">
                    —
                  </Text>
                ) : (
                  impact.added.map((id) => (
                    <Text key={id} size="2">
                      {id}
                    </Text>
                  ))
                )}
              </Flex>
            </Card>
            <Card variant="classic">
              <Flex direction="column" gap="2">
                <Text size="2" weight="medium">
                  {labels.removedLabel}
                </Text>
                {impact.removed.length === 0 ? (
                  <Text size="1" color="gray">
                    —
                  </Text>
                ) : (
                  impact.removed.map((id) => (
                    <Text key={id} size="2">
                      {id}
                    </Text>
                  ))
                )}
              </Flex>
            </Card>
          </Grid>
          <Separator my="2" size="4" />
          <Flex gap="3" wrap="wrap">
            <Button
              onClick={handlePersist}
              disabled={overlayOperations.length === 0 || isSaving || Boolean(mergeError)}
            >
              {labels.persistButton}
            </Button>
            {persistMessage ? (
              <Callout.Root color="green">
                <Callout.Text>{persistMessage}</Callout.Text>
              </Callout.Root>
            ) : null}
            {persistError ? (
              <Callout.Root color="red">
                <Callout.Text>{persistError}</Callout.Text>
              </Callout.Root>
            ) : null}
          </Flex>
        </Flex>
      </Card>
    </Flex>
  );
}
