import React from "react";
import { useTranslations, useFormatter } from "next-intl";

export type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  timestamp: string;
  onBehalfOf?: string;
};

export function AuditLog({ entries }: { entries: AuditEntry[] }) {
  const t = useTranslations("audit");
  const format = useFormatter();
  return (
    <div className="rounded border border-subtle bg-surface-alt p-3" role="region" aria-live="polite">
      <h3 className="font-semibold text-base" id="audit-log-heading">
        {t("title")}
      </h3>
      <ul className="mt-2 space-y-2 text-sm" aria-labelledby="audit-log-heading">
        {entries.map((entry) => (
          <li key={entry.id} className="border-b pb-2">
            <div className="flex justify-between">
              <span>{entry.actor}</span>
              <span className="text-muted-foreground">
                {format.dateTime(new Date(entry.timestamp), { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </div>
            <p className="text-muted-foreground">{entry.action}</p>
            {entry.onBehalfOf && (
              <p className="text-xs text-muted-foreground">{t("onBehalfOf", { organisation: entry.onBehalfOf })}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
