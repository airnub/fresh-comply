"use client";

import { useState } from "react";

export function ActingForBanner({ engager, client }: { engager: string; client: string }) {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return (
      <button className="mt-2 text-sm text-muted-foreground" onClick={() => setVisible(true)}>
        Show engagement banner
      </button>
    );
  }

  return (
    <div className="mt-2 flex items-center justify-between rounded border bg-amber-100 p-3 text-amber-900">
      <div>
        <span className="uppercase">Acting on behalf</span>
        <p className="mt-1 font-medium">
          {engager} → {client}
        </p>
      </div>
      <button className="text-sm text-amber-900" onClick={() => setVisible(false)}>
        Hide
      </button>
    </div>
  );
}
