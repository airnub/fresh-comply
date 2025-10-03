import type { ReactNode } from "react";

export interface DiffViewerProps {
  before?: string | null;
  after?: string | null;
  heading?: ReactNode;
}

export function DiffViewer({ before, after, heading }: DiffViewerProps) {
  return (
    <section aria-live="polite" className="space-y-3">
      {heading ? <header className="text-sm font-semibold text-gray-700">{heading}</header> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-red-200 bg-red-50/60 p-3 text-sm text-red-700">
          <h3 className="mb-2 font-semibold uppercase tracking-wide text-xs text-red-600">Before</h3>
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-red-800">{before ?? "—"}</pre>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-700">
          <h3 className="mb-2 font-semibold uppercase tracking-wide text-xs text-emerald-600">After</h3>
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-emerald-800">{after ?? "—"}</pre>
        </div>
      </div>
    </section>
  );
}
