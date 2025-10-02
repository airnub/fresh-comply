import React from "react";

export type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  timestamp: string;
  onBehalfOf?: string;
};

export function AuditLog({ entries }: { entries: AuditEntry[] }) {
  return (
    <div className="rounded border bg-white p-3">
      <h3 className="font-semibold">Audit trail</h3>
      <ul className="mt-2 space-y-2 text-sm">
        {entries.map((entry) => (
          <li key={entry.id} className="border-b pb-2">
            <div className="flex justify-between">
              <span>{entry.actor}</span>
              <span className="text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</span>
            </div>
            <p className="text-muted-foreground">{entry.action}</p>
            {entry.onBehalfOf && <p className="text-xs text-muted-foreground">On behalf of {entry.onBehalfOf}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
