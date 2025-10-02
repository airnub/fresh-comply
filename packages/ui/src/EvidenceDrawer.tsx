import React from "react";

export type EvidenceItem = {
  id: string;
  title: string;
  sources: { label: string; url: string }[];
  lastVerifiedAt?: string;
};

type EvidenceDrawerProps = {
  items: EvidenceItem[];
  onReverify?: (id: string) => Promise<void> | void;
  reverifyLabel?: string;
  formatTimestamp?: (isoDate?: string) => string;
};

export function EvidenceDrawer({ items, onReverify, reverifyLabel = "Re-verify", formatTimestamp }: EvidenceDrawerProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded border border-subtle bg-surface p-3 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-muted-foreground">
                {formatTimestamp
                  ? formatTimestamp(item.lastVerifiedAt)
                  : `Verified on ${item.lastVerifiedAt ? new Date(item.lastVerifiedAt).toLocaleString() : "—"}`}
              </p>
            </div>
            {onReverify && (
              <button
                className="rounded bg-accent px-3 py-1 text-sm font-medium text-on-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                onClick={() => onReverify(item.id)}
                type="button"
              >
                {reverifyLabel}
              </button>
            )}
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-link">
            {item.sources.map((source) => (
              <li key={source.url}>
                <a className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={source.url} target="_blank" rel="noreferrer">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
