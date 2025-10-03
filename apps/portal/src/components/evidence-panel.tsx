"use client";

import { useState, useTransition } from "react";
import { EvidenceDrawer } from "@airnub/ui";
import { useTranslations } from "next-intl";
import { Text } from "@radix-ui/themes";
import type { Rule } from "@airnub/freshness/verify";
import { SOURCES } from "@airnub/freshness/sources";

export function EvidencePanel({ initialRules }: { initialRules: Rule[] }) {
  const [rules, setRules] = useState(initialRules);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("evidence");

  async function handleReverify(id: string) {
    startTransition(async () => {
      const response = await fetch("/api/reverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId: id })
      });
      if (!response.ok) return;
      const data = await response.json();
      if (!data.rule) return;
      setRules((current) => current.map((rule: Rule) => (rule.id === id ? data.rule : rule)));
    });
  }

  const items = rules.map(mapRuleToItem);

  return (
    <div aria-live="polite">
      {isPending && (
        <Text size="2" color="gray">
          {t("pending")}
        </Text>
      )}
      <EvidenceDrawer
        items={items}
        onReverify={handleReverify}
        reverifyLabel={t("reverify")}
        formatTimestamp={(value) => (value ? t("updated", { date: new Date(value) }) : t("notVerified"))}
      />
    </div>
  );
}

function mapRuleToItem(rule: Rule) {
  const sources = rule.sources.map((sourceKey) => {
    const source = SOURCES[sourceKey];
    return { label: source.label, url: source.url };
  });
  const badgeStatus = rule.status ?? "stale";
  const badgeColor = badgeStatus === "verified" ? "green" : badgeStatus === "pending" ? "amber" : "red";
  const annotation = rule.lastVerifiedAt
    ? `Verified on ${new Date(rule.lastVerifiedAt).toLocaleDateString()}`
    : undefined;
  return {
    id: rule.id,
    title: rule.name,
    sources,
    lastVerifiedAt: rule.lastVerifiedAt,
    annotation,
    badge: { label: `Freshness · ${badgeStatus}`, color: badgeColor },
    metadata:
      rule.evidence?.map((entry) => ({
        label: SOURCES[entry.sourceKey].label,
        value: `${entry.recordCount} records · ${new Date(entry.fetchedAt).toLocaleString()}`
      })) ?? []
  };
}
