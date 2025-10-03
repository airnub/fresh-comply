"use client";

import { useEffect, useMemo, useState } from "react";
import jsonPatch, { type Operation } from "fast-json-patch";
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
  TextArea,
  TextField
} from "@radix-ui/themes";
import type {
  StepExecution,
  WebhookStepExecution,
  WebsocketStepExecution
} from "@airnub/engine/types";
import {
  ExecutionAliasKey,
  isTemporalExecution,
  isWebhookExecution,
  isWebsocketExecution,
  normaliseExecution,
  sanitizeTemporalExecution,
  sanitizeWebhookExecution,
  sanitizeWebsocketExecution
} from "./tenant-overlay-execution";

function filterSecretsByAliases(
  secrets: OverlaySecretBinding[],
  allowed?: string[]
): OverlaySecretBinding[] {
  if (!allowed || allowed.length === 0) {
    return secrets;
  }
  return secrets.filter((secret) => allowed.includes(secret.alias));
}

export type OverlayStepType = {
  slug: string;
  version: string;
  title: string;
  summary: string;
  kind: string;
  execution: StepExecution;
  defaultInput: Record<string, unknown>;
  secretAliases: string[];
  executionAliasOptions?: Partial<Record<ExecutionAliasKey, string[]>>;
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
  executionLabel: string;
  executionHint: string;
  executionWebhookMethod: string;
  executionWebhookUrlAlias: string;
  executionWebhookTokenAlias: string;
  executionWebhookPath: string;
  executionWebhookSigningAlias: string;
  executionTemporalWorkflow: string;
  executionTemporalTaskQueue: string;
  executionTemporalDefaultTaskQueue: string;
  executionWebsocketUrlAlias: string;
  executionWebsocketTokenAlias: string;
  executionWebsocketMessageSchema: string;
  executionWebsocketWorkflow: string;
  executionWebsocketQueue: string;
  executionAliasUnavailable: string;
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
  executionWebhookUrlAliasRequired: string;
  executionWebsocketUrlAliasRequired: string;
  executionAliasInvalid: string;
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
  const [executionState, setExecutionState] = useState<StepExecution>(() =>
    stepTypes[0] ? normaliseExecution(stepTypes[0].execution) : { mode: "manual" }
  );
  const [selectedSecret, setSelectedSecret] = useState<string>(
    secrets[0]?.alias ?? ""
  );
  const [inputError, setInputError] = useState<string | null>(null);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [overlayOperations, setOverlayOperations] = useState<Operation[]>([]);
  const [persistMessage, setPersistMessage] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const mergeResult = useMemo(() => {
    try {
      const result = jsonPatch.applyPatch(structuredClone(baseWorkflow), overlayOperations, true, false);
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

  const executionAliasOptions = useMemo(() => {
    return {
      url: filterSecretsByAliases(
        secrets,
        activeStepType?.executionAliasOptions?.urlAlias
      ),
      token: filterSecretsByAliases(
        secrets,
        activeStepType?.executionAliasOptions?.tokenAlias
      ),
      signing: filterSecretsByAliases(
        secrets,
        activeStepType?.executionAliasOptions?.["signing.secretAlias"]
      )
    };
  }, [activeStepType?.executionAliasOptions, secrets]);

  useEffect(() => {
    if (activeStepType) {
      setInputJson(JSON.stringify(activeStepType.defaultInput ?? {}, null, 2));
      setExecutionState(normaliseExecution(activeStepType.execution));
      setExecutionError(null);
    }
  }, [activeStepType]);

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

    const executionClone = structuredClone(executionState);
    let preparedExecution: StepExecution = executionClone;

    if (isWebhookExecution(executionClone)) {
      const alias = executionClone.config.urlAlias.trim();
      if (!alias) {
        setExecutionError(labels.executionWebhookUrlAliasRequired);
        return;
      }
      if (alias.includes("://")) {
        setExecutionError(labels.executionAliasInvalid);
        return;
      }
      preparedExecution = sanitizeWebhookExecution(executionClone);
    } else if (isWebsocketExecution(executionClone)) {
      const alias = executionClone.config.urlAlias.trim();
      if (!alias) {
        setExecutionError(labels.executionWebsocketUrlAliasRequired);
        return;
      }
      if (alias.includes("://")) {
        setExecutionError(labels.executionAliasInvalid);
        return;
      }
      preparedExecution = sanitizeWebsocketExecution(executionClone);
    } else if (isTemporalExecution(executionClone)) {
      preparedExecution = sanitizeTemporalExecution(executionClone);
    }

    setExecutionError(null);

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
        execution: preparedExecution,
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
    setExecutionError(null);
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

  const renderExecutionFields = () => {
    if (!executionState) {
      return null;
    }

    if (isTemporalExecution(executionState)) {
      return (
        <Flex direction="column" gap="2">
          <label className="space-y-1">
            <Text size="2" weight="medium">
              {labels.executionTemporalWorkflow}
            </Text>
            <TextField.Root
              value={executionState.workflow ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setExecutionState((prev) =>
                  isTemporalExecution(prev)
                    ? {
                        ...prev,
                        workflow: value,
                        config: { ...prev.config, workflow: value }
                      }
                    : prev
                );
                setExecutionError(null);
              }}
            />
          </label>
          <label className="space-y-1">
            <Text size="2" weight="medium">
              {labels.executionTemporalTaskQueue}
            </Text>
            <TextField.Root
              value={executionState.taskQueue ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setExecutionState((prev) =>
                  isTemporalExecution(prev)
                    ? {
                        ...prev,
                        taskQueue: value,
                        config: { ...prev.config, taskQueue: value }
                      }
                    : prev
                );
                setExecutionError(null);
              }}
            />
          </label>
          <label className="space-y-1">
            <Text size="2" weight="medium">
              {labels.executionTemporalDefaultTaskQueue}
            </Text>
            <TextField.Root
              value={executionState.defaultTaskQueue ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setExecutionState((prev) =>
                  isTemporalExecution(prev)
                    ? {
                        ...prev,
                        defaultTaskQueue: value,
                        config: { ...prev.config, defaultTaskQueue: value }
                      }
                    : prev
                );
                setExecutionError(null);
              }}
            />
          </label>
        </Flex>
      );
    }

    if (isWebhookExecution(executionState)) {
      const signingAlias = executionState.config.signing?.secretAlias ?? "";
      return (
        <Flex direction="column" gap="2">
          <label className="space-y-1">
            <Text size="2" weight="medium">
              {labels.executionWebhookMethod}
            </Text>
            <Select.Root
              value={executionState.config.method}
              onValueChange={(value) => {
                setExecutionState((prev) =>
                  isWebhookExecution(prev)
                    ? {
                        ...prev,
                        config: {
                          ...prev.config,
                          method: value as WebhookStepExecution["config"]["method"]
                        }
                      }
                    : prev
                );
                setExecutionError(null);
              }}
            >
              <Select.Trigger className="w-full" />
              <Select.Content>
                {(["GET", "POST", "PUT", "PATCH", "DELETE"] as const).map((method) => (
                  <Select.Item key={method} value={method}>
                    {method}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </label>
          <label className="space-y-1">
            <Text size="2" weight="medium">
              {labels.executionWebhookUrlAlias}
            </Text>
            <Select.Root
              value={executionState.config.urlAlias}
              onValueChange={(value) => {
                setExecutionState((prev) =>
                  isWebhookExecution(prev)
                    ? { ...prev, config: { ...prev.config, urlAlias: value } }
                    : prev
                );
                setExecutionError(null);
              }}
            >
              <Select.Trigger
                className="w-full"
                placeholder={labels.secretPlaceholder}
                disabled={executionAliasOptions.url.length === 0}
              />
              <Select.Content>
                {executionAliasOptions.url.map((option) => (
                  <Select.Item key={option.alias} value={option.alias}>
                    {option.alias}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            {executionAliasOptions.url.length === 0 ? (
              <Text size="1" color="gray">
                {labels.executionAliasUnavailable}
              </Text>
            ) : null}
          </label>
          <label className="space-y-1">
            <Text size="2" weight="medium">
              {labels.executionWebhookTokenAlias}
            </Text>
            <Select.Root
              value={executionState.config.tokenAlias ?? ""}
              onValueChange={(value) => {
                setExecutionState((prev) =>
                  isWebhookExecution(prev)
                    ? { ...prev, config: { ...prev.config, tokenAlias: value } }
                    : prev
                );
                setExecutionError(null);
              }}
            >
              <Select.Trigger
                className="w-full"
                placeholder={labels.secretPlaceholder}
                disabled={executionAliasOptions.token.length === 0}
              />
              <Select.Content>
                <Select.Item value="">{labels.secretPlaceholder}</Select.Item>
                {executionAliasOptions.token.map((option) => (
                  <Select.Item key={option.alias} value={option.alias}>
                    {option.alias}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            {executionAliasOptions.token.length === 0 ? (
              <Text size="1" color="gray">
                {labels.executionAliasUnavailable}
              </Text>
            ) : null}
          </label>
          <label className="space-y-1">
            <Text size="2" weight="medium">
              {labels.executionWebhookPath}
            </Text>
            <TextField.Root
              value={executionState.config.path ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setExecutionState((prev) =>
                  isWebhookExecution(prev)
                    ? { ...prev, config: { ...prev.config, path: value } }
                    : prev
                );
                setExecutionError(null);
              }}
            />
          </label>
          <label className="space-y-1">
            <Text size="2" weight="medium">
              {labels.executionWebhookSigningAlias}
            </Text>
            <Select.Root
              value={signingAlias}
              onValueChange={(value) => {
                setExecutionState((prev) =>
                  isWebhookExecution(prev)
                    ? {
                        ...prev,
                        config: {
                          ...prev.config,
                          signing:
                            value.length > 0
                              ? {
                                  algo: prev.config.signing?.algo ?? "hmac-sha256",
                                  secretAlias: value
                                }
                              : undefined
                        }
                      }
                    : prev
                );
                setExecutionError(null);
              }}
            >
              <Select.Trigger
                className="w-full"
                placeholder={labels.secretPlaceholder}
                disabled={executionAliasOptions.signing.length === 0}
              />
              <Select.Content>
                <Select.Item value="">{labels.secretPlaceholder}</Select.Item>
                {executionAliasOptions.signing.map((option) => (
                  <Select.Item key={option.alias} value={option.alias}>
                    {option.alias}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            {executionAliasOptions.signing.length === 0 ? (
              <Text size="1" color="gray">
                {labels.executionAliasUnavailable}
              </Text>
            ) : null}
          </label>
        </Flex>
      );
    }

    if (isWebsocketExecution(executionState)) {
      return (
        <Flex direction="column" gap="2">
          <label className="space-y-1">
            <Text size="2" weight="medium">
              {labels.executionWebsocketUrlAlias}
            </Text>
            <Select.Root
              value={executionState.config.urlAlias}
              onValueChange={(value) => {
                setExecutionState((prev) =>
                  isWebsocketExecution(prev)
                    ? { ...prev, config: { ...prev.config, urlAlias: value } }
                    : prev
                );
                setExecutionError(null);
              }}
            >
              <Select.Trigger
                className="w-full"
                placeholder={labels.secretPlaceholder}
                disabled={executionAliasOptions.url.length === 0}
              />
              <Select.Content>
                {executionAliasOptions.url.map((option) => (
                  <Select.Item key={option.alias} value={option.alias}>
                    {option.alias}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            {executionAliasOptions.url.length === 0 ? (
              <Text size="1" color="gray">
                {labels.executionAliasUnavailable}
              </Text>
            ) : null}
          </label>
          <label className="space-y-1">
            <Text size="2" weight="medium">
              {labels.executionWebsocketTokenAlias}
            </Text>
            <Select.Root
              value={executionState.config.tokenAlias ?? ""}
              onValueChange={(value) => {
                setExecutionState((prev) =>
                  isWebsocketExecution(prev)
                    ? { ...prev, config: { ...prev.config, tokenAlias: value } }
                    : prev
                );
                setExecutionError(null);
              }}
            >
              <Select.Trigger
                className="w-full"
                placeholder={labels.secretPlaceholder}
                disabled={executionAliasOptions.token.length === 0}
              />
              <Select.Content>
                <Select.Item value="">{labels.secretPlaceholder}</Select.Item>
                {executionAliasOptions.token.map((option) => (
                  <Select.Item key={option.alias} value={option.alias}>
                    {option.alias}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            {executionAliasOptions.token.length === 0 ? (
              <Text size="1" color="gray">
                {labels.executionAliasUnavailable}
              </Text>
            ) : null}
          </label>
          <label className="space-y-1">
            <Text size="2" weight="medium">
              {labels.executionWebsocketMessageSchema}
            </Text>
            <TextField.Root
              value={executionState.config.messageSchema ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setExecutionState((prev) =>
                  isWebsocketExecution(prev)
                    ? { ...prev, config: { ...prev.config, messageSchema: value } }
                    : prev
                );
                setExecutionError(null);
              }}
            />
          </label>
          <label className="space-y-1">
            <Text size="2" weight="medium">
              {labels.executionWebsocketWorkflow}
            </Text>
            <TextField.Root
              value={executionState.config.temporalWorkflow ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setExecutionState((prev) =>
                  isWebsocketExecution(prev)
                    ? { ...prev, config: { ...prev.config, temporalWorkflow: value } }
                    : prev
                );
                setExecutionError(null);
              }}
            />
          </label>
          <label className="space-y-1">
            <Text size="2" weight="medium">
              {labels.executionWebsocketQueue}
            </Text>
            <TextField.Root
              value={executionState.config.defaultTaskQueue ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setExecutionState((prev) =>
                  isWebsocketExecution(prev)
                    ? { ...prev, config: { ...prev.config, defaultTaskQueue: value } }
                    : prev
                );
                setExecutionError(null);
              }}
            />
          </label>
        </Flex>
      );
    }

    return null;
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

              <div className="space-y-2">
                <Text size="2" weight="medium">
                  {labels.executionLabel}
                </Text>
                <Text size="1" color="gray">
                  {labels.executionHint}
                </Text>
                {renderExecutionFields()}
                {executionError ? (
                  <Text size="1" color="red">{executionError}</Text>
                ) : null}
              </div>

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
