import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { StepTypeActionsClient } from "../step-type-actions.client";
import type {
  StepTypeRegistryEntry,
  StepTypeVersionLedgerEntry,
  TenantSecretBinding,
  TenantStepTypeInstall,
} from "../types";

const registry: StepTypeRegistryEntry[] = [
  {
    id: "st-1",
    slug: "temporal.webhook",
    title: "Temporal Webhook",
    category: "automation",
    latest_version: "1.0.0",
    summary: "",
    published_versions: 1,
  },
];

const versions: StepTypeVersionLedgerEntry[] = [
  {
    id: "stv-1",
    step_type_slug: "temporal.webhook",
    version: "1.0.0",
    status: "draft",
    published_at: null,
    schema_slug: "schemas/example@1",
  },
];

const installs: TenantStepTypeInstall[] = [];
const bindings: TenantSecretBinding[] = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("StepTypeActionsClient", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok", auditId: "audit-123" }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits publish flow to admin API", async () => {
    render(
      <StepTypeActionsClient
        registry={registry}
        versions={versions}
        tenantInstalls={installs}
        secretBindings={bindings}
      />
    );

    const stepSelect = screen.getAllByTestId("publish-step-type-select")[0];
    await userEvent.selectOptions(stepSelect, "st-1");

    const publishForm = await screen.findByTestId("publish-form");
    const versionSelect = within(publishForm).getByTestId("publish-version-select");
    await userEvent.selectOptions(versionSelect, "stv-1");

    const reason = await screen.findByLabelText(/Reason code/i, { selector: "textarea#publish-reason" });
    await userEvent.type(reason, "publishing to production");

    const submit = await screen.findByRole("button", { name: /Publish version/i });
    await userEvent.click(submit);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/step-types/st-1/publish",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "content-type": "application/json" }),
        })
      );
    });

    const payload = JSON.parse((global.fetch as unknown as vi.Mock).mock.calls[0][1].body as string);
    expect(payload).toMatchObject({
      reason: "publishing to production",
      version: "stv-1",
    });

    const publishStatuses = await screen.findAllByRole("status");
    const publishStatus = publishStatuses[publishStatuses.length - 1];
    expect(publishStatus).toHaveTextContent("ok");
    expect(publishStatus).toHaveTextContent("audit-123");
  });

  it("submits tenant install flow to admin API", async () => {
    (global.fetch as unknown as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "install complete", auditId: "audit-install" }),
    } as Response);

    render(
      <StepTypeActionsClient
        registry={registry}
        versions={versions}
        tenantInstalls={installs}
        secretBindings={bindings}
      />
    );

    const stepSelect = screen.getAllByTestId("install-step-type-select")[0];
    await userEvent.selectOptions(stepSelect, "st-1");

    const orgField = await screen.findByLabelText(/Tenant organisation slug/i);
    await userEvent.type(orgField, "tenant-one");

    const installForm = await screen.findByTestId("install-form");
    const versionSelect = within(installForm).getByTestId("install-version-select");
    await userEvent.selectOptions(versionSelect, "stv-1");

    const reason = await screen.findByLabelText(/Reason code/i, { selector: "textarea#install-reason" });
    await userEvent.type(reason, "enable for beta");

    const submit = await screen.findByRole("button", { name: /Enable tenant/i });
    await userEvent.click(submit);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/step-types/st-1/tenants",
        expect.objectContaining({ method: "POST" })
      );
    });

    const payload = JSON.parse((global.fetch as unknown as vi.Mock).mock.calls[0][1].body as string);
    expect(payload).toMatchObject({
      reason: "enable for beta",
      install: { org_slug: "tenant-one", version_id: "stv-1", follow_latest: false },
    });

    const installStatuses = await screen.findAllByRole("status");
    const installStatus = installStatuses[installStatuses.length - 1];
    expect(installStatus).toHaveTextContent("install complete");
    expect(installStatus).toHaveTextContent("audit-install");
  });
});
