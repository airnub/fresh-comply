"use client";

import { useState, useTransition } from "react";
import { EvidenceDrawer, EvidenceItem } from "@airnub/ui";

export function EvidencePanel({ initialItems }: { initialItems: EvidenceItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();

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
    <div>
      {isPending && <p className="text-sm text-muted-foreground">Re-verifying…</p>}
      <EvidenceDrawer items={items} onReverify={handleReverify} />
    </div>
  );
}
