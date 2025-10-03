"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Box, Button, Flex, Grid, Table, Text, TextField } from "@radix-ui/themes";
import type { Tables } from "@airnub/types";

export type TenantDomain = Tables<"tenant_domains">;

type PanelCopy = {
  labels: {
    domain: string;
    status: string;
    verifiedAt: string;
    actions: string;
  };
  actions: {
    add: string;
    verify: string;
    setPrimary: string;
    remove: string;
  };
  messages: {
    added: string;
    verified: string;
    removed: string;
    error: string;
    empty: string;
    primary: string;
  };
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  provisioning: "Provisioning",
  issued: "Issued",
  failed: "Failed",
  revoked: "Revoked"
};

export default function TenantDomainsPanel({
  initialDomains,
  copy
}: {
  initialDomains: TenantDomain[];
  copy: PanelCopy;
}) {
  const [domains, setDomains] = useState(initialDomains);
  const [domainInput, setDomainInput] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAddDomain = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!domainInput.trim()) {
      return;
    }

    setMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/partner-admin/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainInput.trim() })
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        setMessage({ type: "error", text: error.error ?? copy.messages.error });
        return;
      }

      const body = (await response.json()) as { domain: TenantDomain };
      setDomains((previous) => [body.domain, ...previous.filter((d) => d.id !== body.domain.id)]);
      setDomainInput("");
      setMessage({ type: "success", text: copy.messages.added });
    });
  };

  const runDomainAction = async (
    action: "verify" | "setPrimary" | "remove",
    domain: TenantDomain
  ) => {
    setMessage(null);

    if (action === "remove") {
      const response = await fetch(`/api/partner-admin/domains?id=${domain.id}`, { method: "DELETE" });
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        setMessage({ type: "error", text: error.error ?? copy.messages.error });
        return;
      }
      setDomains((previous) => previous.filter((entry) => entry.id !== domain.id));
      setMessage({ type: "success", text: copy.messages.removed });
      return;
    }

    const response = await fetch(`/api/partner-admin/domains`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "verify"
          ? { action: "verify", domainId: domain.id }
          : { action: "setPrimary", domain: domain.domain }
      )
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { error?: string };
      setMessage({ type: "error", text: error.error ?? copy.messages.error });
      return;
    }

    const body = (await response.json()) as { domain: TenantDomain };
    if (action === "setPrimary") {
      setDomains((previous) =>
        previous.map((entry) => ({
          ...entry,
          is_primary: entry.id === body.domain.id
        }))
      );
      setMessage({ type: "success", text: copy.messages.primary });
    } else {
      setDomains((previous) => previous.map((entry) => (entry.id === body.domain.id ? body.domain : entry)));
      setMessage({ type: "success", text: copy.messages.verified });
    }
  };

  return (
    <Flex direction="column" gap="4">
      <form onSubmit={handleAddDomain}>
        <Grid columns={{ initial: "1", sm: "2" }} gap="3" align="center">
          <TextField.Root
            value={domainInput}
            onChange={(event) => setDomainInput(event.target.value)}
            placeholder="tenant.example.com"
            aria-label={copy.labels.domain}
          />
          <Button type="submit" disabled={isPending}>
            {copy.actions.add}
          </Button>
        </Grid>
      </form>
      {message ? (
        <Text as="p" color={message.type === "success" ? "green" : "red"}>
          {message.text}
        </Text>
      ) : null}
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>{copy.labels.domain}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{copy.labels.status}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{copy.labels.verifiedAt}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{copy.labels.actions}</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {domains.map((domain) => (
            <Table.Row key={domain.id}>
              <Table.Cell>{domain.domain}</Table.Cell>
              <Table.Cell>
                {domain.is_primary ? `${STATUS_LABELS[domain.cert_status] ?? domain.cert_status} • Primary` : STATUS_LABELS[domain.cert_status] ?? domain.cert_status}
              </Table.Cell>
              <Table.Cell>
                {domain.verified_at ? new Date(domain.verified_at).toLocaleDateString() : "—"}
              </Table.Cell>
              <Table.Cell>
                <Flex gap="2">
                  <Button
                    size="1"
                    variant="soft"
                    onClick={() => runDomainAction("verify", domain)}
                    disabled={domain.verified_at !== null}
                  >
                    {copy.actions.verify}
                  </Button>
                  <Button
                    size="1"
                    variant="soft"
                    onClick={() => runDomainAction("setPrimary", domain)}
                    disabled={domain.is_primary}
                  >
                    {copy.actions.setPrimary}
                  </Button>
                  <Button
                    size="1"
                    variant="ghost"
                    color="red"
                    onClick={() => runDomainAction("remove", domain)}
                  >
                    {copy.actions.remove}
                  </Button>
                </Flex>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      {domains.length === 0 ? (
        <Box>
          <Text as="p" color="gray">
            {copy.messages.empty}
          </Text>
        </Box>
      ) : null}
    </Flex>
  );
}
