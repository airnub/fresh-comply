"use client";

import { useState, useTransition } from "react";
import { EvidenceDrawer, EvidenceItem } from "@airnub/ui";
import { useTranslations } from "next-intl";

export function EvidencePanel({ initialItems }: { initialItems: EvidenceItem[] }) {
  const [items, setItems] = useState(initialItems);
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
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, lastVerifiedAt: data.rule.lastVerifiedAt }
            : item
        )
      );
    });
  }

  return (
    <div aria-live="polite">
      {isPending && <p className="text-sm text-muted-foreground">{t("pending")}</p>}
      <EvidenceDrawer
        items={items}
        onReverify={handleReverify}
        reverifyLabel={t("reverify")}
        formatTimestamp={(value) => (value ? t("updated", { date: new Date(value) }) : t("notVerified"))}
      />
    </div>
  );
}
