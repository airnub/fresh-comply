"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  StepTypeRegistryEntry,
  StepTypeVersionLedgerEntry,
  TenantSecretBinding,
  TenantStepTypeInstall,
} from "./types";
import type { StepTypeActionsProps } from "./step-type-actions";
import { ApiResultCallout } from "@/components/ApiResultCallout";

interface MutationState {
  submitting: boolean;
  result: { message: string; auditId?: string | null; warnings?: string[] } | null;
  error: { message: string; details?: string | null; validationErrors?: string[] | null } | null;
}

interface AdminMutationInit {
  path: string;
  method?: string;
}

function useAdminMutation({ path, method = "POST" }: AdminMutationInit) {
  const router = useRouter();
  const [state, setState] = useState<MutationState>({ submitting: false, result: null, error: null });

  async function execute(payload: Record<string, unknown>) {
    setState({ submitting: true, result: null, error: null });
    try {
      const response = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        setState({
          submitting: false,
          result: null,
          error: {
            message: (data.error as string) ?? "Request failed",
            details: (data.details as string | undefined) ?? null,
            validationErrors: (data.validationErrors as string[] | undefined) ?? null,
          },
        });
        return null;
      }

      const result = {
        message: (data.message as string) ?? "Mutation completed",
        auditId: (data.auditId as string | undefined) ?? (data.audit_id as string | undefined) ?? null,
        warnings: (data.warnings as string[] | undefined) ?? undefined,
      };

      setState({ submitting: false, result, error: null });
      router.refresh();
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      setState({ submitting: false, result: null, error: { message } });
      return null;
    }
  }

  return { ...state, execute };
}

function StepTypeOption({ stepType }: { stepType: StepTypeRegistryEntry }) {
  const label = `${stepType.title} (${stepType.slug})`;
  return <option value={stepType.id}>{label}</option>;
}

const providers = [
  { value: "hashicorp", label: "HashiCorp Vault" },
  { value: "aws-sm", label: "AWS Secrets Manager" },
  { value: "supabase-kv", label: "Supabase Vault" },
  { value: "env", label: "Environment Variable" },
];

function resolveStepTypeById(registry: StepTypeRegistryEntry[], id: string | undefined) {
  return registry.find((item) => item.id === id);
}

function resolveVersionForStepType(
  versions: StepTypeVersionLedgerEntry[],
  registry: StepTypeRegistryEntry[],
  stepTypeId?: string
) {
  const stepType = stepTypeId ? resolveStepTypeById(registry, stepTypeId) : undefined;
  if (!stepType) {
    return versions.filter((version) => version.status !== "archived");
  }

  return versions.filter((version) => version.step_type_slug === stepType.slug);
}

export function StepTypeActionsClient({ registry, versions, tenantInstalls, secretBindings }: StepTypeActionsProps) {
  const createMutation = useAdminMutation({ path: "/api/admin/step-types" });
  const [createForm, setCreateForm] = useState({
    slug: "",
    title: "",
    category: "automation",
    summary: "",
    executionMode: "manual",
    version: "1.0.0",
    inputSchemaSlug: "",
    reason: "",
  });

  const [editStepTypeId, setEditStepTypeId] = useState<string | undefined>();
  const editMutation = useAdminMutation({
    path: editStepTypeId ? `/api/admin/step-types/${editStepTypeId}` : "/api/admin/step-types",
    method: editStepTypeId ? "PATCH" : "POST",
  });
  const [editForm, setEditForm] = useState({
    title: "",
    summary: "",
    executionMode: "manual",
    inputSchemaSlug: "",
    reason: "",
  });

  const [publishStepTypeId, setPublishStepTypeId] = useState<string | undefined>();
  const publishMutation = useAdminMutation({
    path: publishStepTypeId ? `/api/admin/step-types/${publishStepTypeId}/publish` : "/api/admin/step-types",
  });
  const [publishForm, setPublishForm] = useState({
    version: "",
    changelog: "",
    reason: "",
  });

  const [installStepTypeId, setInstallStepTypeId] = useState<string | undefined>();
  const installMutation = useAdminMutation({
    path: installStepTypeId ? `/api/admin/step-types/${installStepTypeId}/tenants` : "/api/admin/step-types",
  });
  const [installForm, setInstallForm] = useState({
    orgSlug: "",
    versionId: "",
    followLatest: false,
    reason: "",
  });

  const [bindingStepTypeId, setBindingStepTypeId] = useState<string | undefined>();
  const bindingMutation = useAdminMutation({
    path: bindingStepTypeId ? `/api/admin/step-types/${bindingStepTypeId}/secret-bindings` : "/api/admin/step-types",
  });
  const [bindingForm, setBindingForm] = useState({
    orgSlug: "",
    alias: "",
    provider: providers[0]?.value ?? "hashicorp",
    externalId: "",
    reason: "",
  });

  const selectedEditStepType = useMemo(() => resolveStepTypeById(registry, editStepTypeId), [registry, editStepTypeId]);
  const selectedPublishStepType = useMemo(
    () => resolveStepTypeById(registry, publishStepTypeId),
    [registry, publishStepTypeId]
  );
  const selectedInstallStepType = useMemo(
    () => resolveStepTypeById(registry, installStepTypeId),
    [registry, installStepTypeId]
  );
  const selectedBindingStepType = useMemo(
    () => resolveStepTypeById(registry, bindingStepTypeId),
    [registry, bindingStepTypeId]
  );

  function handleEditSelection(stepTypeId: string) {
    setEditStepTypeId(stepTypeId);
    const next = resolveStepTypeById(registry, stepTypeId);
    if (next) {
      setEditForm({
        title: next.title,
        summary: next.summary ?? "",
        executionMode: "manual",
        inputSchemaSlug: "",
        reason: "",
      });
    }
  }

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createMutation.execute({
      reason: createForm.reason,
      stepType: {
        slug: createForm.slug,
        title: createForm.title,
        category: createForm.category,
        summary: createForm.summary,
        execution_mode: createForm.executionMode,
        version: createForm.version,
        input_schema_slug: createForm.inputSchemaSlug,
      },
    });
  }

  async function submitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editStepTypeId) {
      return;
    }
    await editMutation.execute({
      reason: editForm.reason,
      patch: {
        title: editForm.title,
        summary: editForm.summary,
        execution_mode: editForm.executionMode,
        input_schema_slug: editForm.inputSchemaSlug,
      },
    });
  }

  async function submitPublish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!publishStepTypeId) {
      return;
    }
    await publishMutation.execute({
      reason: publishForm.reason,
      version: publishForm.version,
      changelog: publishForm.changelog,
    });
  }

  async function submitInstall(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!installStepTypeId) {
      return;
    }
    await installMutation.execute({
      reason: installForm.reason,
      install: {
        org_slug: installForm.orgSlug,
        version_id: installForm.versionId,
        follow_latest: installForm.followLatest,
      },
    });
  }

  async function submitBinding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bindingStepTypeId) {
      return;
    }
    await bindingMutation.execute({
      reason: bindingForm.reason,
      binding: {
        org_slug: bindingForm.orgSlug,
        alias: bindingForm.alias,
        provider: bindingForm.provider,
        external_id: bindingForm.externalId,
      },
    });
  }

  const versionOptions = useMemo(() => {
    return versions.map((item) => ({
      id: item.id,
      label: `${item.step_type_slug}@${item.version} (${item.status})`,
    }));
  }, [versions]);

  const installVersionOptions = useMemo(() => {
    return resolveVersionForStepType(versions, registry, installStepTypeId).map((item) => ({
      id: item.id,
      label: `${item.step_type_slug}@${item.version} (${item.status})`,
    }));
  }, [versions, registry, installStepTypeId]);

  const installTenantCount = useMemo(
    () => new Set(tenantInstalls.map((install) => install.org_slug)).size,
    [tenantInstalls]
  );
  const bindingTenantCount = useMemo(
    () => new Set(secretBindings.map((binding) => binding.tenant_name)).size,
    [secretBindings]
  );

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="space-y-4">
        <div className="space-y-4 rounded-lg border border-gray-200 p-4">
          <header className="space-y-1">
            <h3 className="text-base font-semibold text-gray-900">Create step type</h3>
            <p className="text-sm text-gray-600">Submit a new step type draft with an initial version.</p>
          </header>
          <form className="space-y-3" onSubmit={submitCreate}>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="create-slug">
                Slug
              </label>
              <input
                id="create-slug"
                value={createForm.slug}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, slug: event.target.value }))}
                required
                className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="create-title">
                Title
              </label>
              <input
                id="create-title"
                value={createForm.title}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                required
                className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="create-category">
                Category
              </label>
              <input
                id="create-category"
                value={createForm.category}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, category: event.target.value }))}
                required
                className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="create-summary">
                Summary
              </label>
              <textarea
                id="create-summary"
                value={createForm.summary}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, summary: event.target.value }))}
                rows={3}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="create-execution-mode">
                Execution mode
              </label>
              <select
                id="create-execution-mode"
                value={createForm.executionMode}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, executionMode: event.target.value }))}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="manual">Manual</option>
                <option value="temporal">Temporal</option>
                <option value="external:webhook">External — Webhook</option>
                <option value="external:websocket">External — WebSocket</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="create-version">
                Initial version
              </label>
              <input
                id="create-version"
                value={createForm.version}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, version: event.target.value }))}
                required
                pattern="^\\d+\\.\\d+\\.\\d+$"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="create-input-schema">
                Input schema slug
              </label>
              <input
                id="create-input-schema"
                value={createForm.inputSchemaSlug}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, inputSchemaSlug: event.target.value }))}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="schemas/example@1"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="create-reason">
                Reason code
              </label>
              <textarea
                id="create-reason"
                value={createForm.reason}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, reason: event.target.value }))}
                required
                rows={2}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={createMutation.submitting}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {createMutation.submitting ? "Creating…" : "Create step type"}
            </button>
          </form>
          <ApiResultCallout result={createMutation.result} error={createMutation.error} />
        </div>

        <div className="space-y-4 rounded-lg border border-gray-200 p-4">
          <header className="space-y-1">
            <h3 className="text-base font-semibold text-gray-900">Edit step type</h3>
            <p className="text-sm text-gray-600">Update metadata and schemas for an existing step type.</p>
          </header>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="edit-step-type">
              Step type
            </label>
            <select
              id="edit-step-type"
              value={editStepTypeId ?? ""}
              onChange={(event) => handleEditSelection(event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                Select a step type
              </option>
              {registry.map((stepType) => (
                <StepTypeOption key={stepType.id} stepType={stepType} />
              ))}
            </select>
          </div>
          {selectedEditStepType ? (
            <form className="space-y-3" onSubmit={submitEdit}>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="edit-title">
                  Title
                </label>
                <input
                  id="edit-title"
                  value={editForm.title}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                  required
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="edit-summary">
                  Summary
                </label>
                <textarea
                  id="edit-summary"
                  value={editForm.summary}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, summary: event.target.value }))}
                  rows={3}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="edit-execution-mode">
                  Execution mode
                </label>
                <select
                  id="edit-execution-mode"
                  value={editForm.executionMode}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, executionMode: event.target.value }))}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="manual">Manual</option>
                  <option value="temporal">Temporal</option>
                  <option value="external:webhook">External — Webhook</option>
                  <option value="external:websocket">External — WebSocket</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="edit-input-schema">
                  Input schema slug
                </label>
                <input
                  id="edit-input-schema"
                  value={editForm.inputSchemaSlug}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, inputSchemaSlug: event.target.value }))}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="edit-reason">
                  Reason code
                </label>
                <textarea
                  id="edit-reason"
                  value={editForm.reason}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, reason: event.target.value }))}
                  required
                  rows={2}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={editMutation.submitting}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {editMutation.submitting ? "Saving…" : "Save changes"}
              </button>
            </form>
          ) : (
            <p className="text-sm text-gray-500">Select a step type to edit.</p>
          )}
          <ApiResultCallout result={editMutation.result} error={editMutation.error} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-4 rounded-lg border border-gray-200 p-4">
          <header className="space-y-1">
            <h3 className="text-base font-semibold text-gray-900">Publish version</h3>
            <p className="text-sm text-gray-600">Publish a draft version to tenants and append an audit entry.</p>
          </header>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="publish-step-type">
              Step type
            </label>
            <select
              id="publish-step-type"
              value={publishStepTypeId ?? ""}
              onChange={(event) => setPublishStepTypeId(event.target.value)}
              data-testid="publish-step-type-select"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                Select a step type
              </option>
              {registry.map((stepType) => (
                <StepTypeOption key={stepType.id} stepType={stepType} />
              ))}
            </select>
          </div>
          {selectedPublishStepType ? (
            <form className="space-y-3" data-testid="publish-form" onSubmit={submitPublish}>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="publish-version">
                  Version
                </label>
                <select
                  id="publish-version"
                  value={publishForm.version}
                  onChange={(event) => setPublishForm((prev) => ({ ...prev, version: event.target.value }))}
                  required
                  data-testid="publish-version-select"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>
                    Select a version
                  </option>
                  {resolveVersionForStepType(versions, registry, publishStepTypeId).map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.version} ({version.status})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="publish-changelog">
                  Changelog
                </label>
                <textarea
                  id="publish-changelog"
                  value={publishForm.changelog}
                  onChange={(event) => setPublishForm((prev) => ({ ...prev, changelog: event.target.value }))}
                  rows={3}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="publish-reason">
                  Reason code
                </label>
                <textarea
                  id="publish-reason"
                  value={publishForm.reason}
                  onChange={(event) => setPublishForm((prev) => ({ ...prev, reason: event.target.value }))}
                  required
                  rows={2}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={publishMutation.submitting}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {publishMutation.submitting ? "Publishing…" : "Publish version"}
              </button>
            </form>
          ) : (
            <p className="text-sm text-gray-500">Select a step type to publish.</p>
          )}
          <ApiResultCallout result={publishMutation.result} error={publishMutation.error} />
        </div>

        <div className="space-y-4 rounded-lg border border-gray-200 p-4">
          <header className="space-y-1">
            <h3 className="text-base font-semibold text-gray-900">Enable tenant</h3>
            <p className="text-sm text-gray-600">
              Install a step type for a tenant and optionally follow latest versions. {installTenantCount} tenants currently have
              installs.
            </p>
          </header>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="install-step-type">
              Step type
            </label>
            <select
              id="install-step-type"
              value={installStepTypeId ?? ""}
              onChange={(event) => setInstallStepTypeId(event.target.value)}
              data-testid="install-step-type-select"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                Select a step type
              </option>
              {registry.map((stepType) => (
                <StepTypeOption key={stepType.id} stepType={stepType} />
              ))}
            </select>
          </div>
          {selectedInstallStepType ? (
            <form className="space-y-3" data-testid="install-form" onSubmit={submitInstall}>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="install-org">
                  Tenant organisation slug
                </label>
                <input
                  id="install-org"
                  value={installForm.orgSlug}
                  onChange={(event) => setInstallForm((prev) => ({ ...prev, orgSlug: event.target.value }))}
                  required
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="install-version">
                  Version
                </label>
                <select
                  id="install-version"
                  value={installForm.versionId}
                  onChange={(event) => setInstallForm((prev) => ({ ...prev, versionId: event.target.value }))}
                  required={!installForm.followLatest}
                  data-testid="install-version-select"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>
                    Select a version
                  </option>
                  {installVersionOptions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={installForm.followLatest}
                  onChange={(event) =>
                    setInstallForm((prev) => ({
                      ...prev,
                      followLatest: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Follow latest version automatically
              </label>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="install-reason">
                  Reason code
                </label>
                <textarea
                  id="install-reason"
                  value={installForm.reason}
                  onChange={(event) => setInstallForm((prev) => ({ ...prev, reason: event.target.value }))}
                  required
                  rows={2}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={installMutation.submitting}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {installMutation.submitting ? "Enabling…" : "Enable tenant"}
              </button>
            </form>
          ) : (
            <p className="text-sm text-gray-500">Select a step type to manage installs.</p>
          )}
          <ApiResultCallout result={installMutation.result} error={installMutation.error} />
        </div>

        <div className="space-y-4 rounded-lg border border-gray-200 p-4">
          <header className="space-y-1">
            <h3 className="text-base font-semibold text-gray-900">Bind secret alias</h3>
            <p className="text-sm text-gray-600">
              Associate a secret alias with a tenant install for runtime credentials. {bindingTenantCount} tenants currently have
              bindings.
            </p>
          </header>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="binding-step-type">
              Step type
            </label>
            <select
              id="binding-step-type"
              value={bindingStepTypeId ?? ""}
              onChange={(event) => setBindingStepTypeId(event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                Select a step type
              </option>
              {registry.map((stepType) => (
                <StepTypeOption key={stepType.id} stepType={stepType} />
              ))}
            </select>
          </div>
          {selectedBindingStepType ? (
            <form className="space-y-3" onSubmit={submitBinding}>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="binding-org">
                  Tenant organisation slug
                </label>
                <input
                  id="binding-org"
                  value={bindingForm.orgSlug}
                  onChange={(event) => setBindingForm((prev) => ({ ...prev, orgSlug: event.target.value }))}
                  required
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="binding-alias">
                  Secret alias
                </label>
                <input
                  id="binding-alias"
                  value={bindingForm.alias}
                  onChange={(event) => setBindingForm((prev) => ({ ...prev, alias: event.target.value }))}
                  required
                  pattern="^secrets\\.[a-zA-Z0-9_.:-]+$"
                  placeholder="secrets.example.apiKey"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="binding-provider">
                  Provider
                </label>
                <select
                  id="binding-provider"
                  value={bindingForm.provider}
                  onChange={(event) => setBindingForm((prev) => ({ ...prev, provider: event.target.value }))}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {providers.map((provider) => (
                    <option key={provider.value} value={provider.value}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="binding-external-id">
                  Provider reference
                </label>
                <input
                  id="binding-external-id"
                  value={bindingForm.externalId}
                  onChange={(event) => setBindingForm((prev) => ({ ...prev, externalId: event.target.value }))}
                  required
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="binding-reason">
                  Reason code
                </label>
                <textarea
                  id="binding-reason"
                  value={bindingForm.reason}
                  onChange={(event) => setBindingForm((prev) => ({ ...prev, reason: event.target.value }))}
                  required
                  rows={2}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={bindingMutation.submitting}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {bindingMutation.submitting ? "Binding…" : "Bind secret alias"}
              </button>
            </form>
          ) : (
            <p className="text-sm text-gray-500">Select a step type to manage secret bindings.</p>
          )}
          <ApiResultCallout result={bindingMutation.result} error={bindingMutation.error} />
        </div>
      </section>
    </div>
  );
}
