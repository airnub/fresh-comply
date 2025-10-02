import React from "react";

export type EvidenceItem = {
  id: string;
  title: string;
  sources: { label: string; url: string }[];
  lastVerifiedAt?: string;
};

export function EvidenceDrawer({ items, onReverify }: { items: EvidenceItem[]; onReverify?: (id: string) => Promise<void> | void }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-muted-foreground">
                Verified on {item.lastVerifiedAt ? new Date(item.lastVerifiedAt).toLocaleString() : "—"}
              </p>
            </div>
            {onReverify && (
              <button
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
                onClick={() => onReverify(item.id)}
                type="button"
              >
                Re-verify
              </button>
            )}
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-700">
            {item.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">
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
