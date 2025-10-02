"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

export function ActingForBanner({ engager, client }: { engager: string; client: string }) {
  const [visible, setVisible] = useState(true);
  const t = useTranslations("actingFor");

  if (!visible) {
    return (
      <button
        className="mt-2 text-sm text-muted-foreground underline"
        onClick={() => setVisible(true)}
        aria-expanded={visible}
        aria-controls="acting-for-banner"
        type="button"
      >
        {t("toggleShow")}
      </button>
    );
  }

  return (
    <div
      id="acting-for-banner"
      className="mt-2 flex items-center justify-between rounded border border-accent bg-highlight p-3 text-highlight-foreground"
    >
      <div>
        <span className="block text-xs font-semibold uppercase tracking-wide">{t("badge")}</span>
        <p className="mt-1 font-medium" aria-live="polite">
          {t("separator", { engager, client })}
        </p>
      </div>
      <button
        className="text-sm font-medium underline"
        onClick={() => setVisible(false)}
        aria-expanded={visible}
        aria-controls="acting-for-banner"
        type="button"
      >
        {t("toggleHide")}
      </button>
    </div>
  );
}
