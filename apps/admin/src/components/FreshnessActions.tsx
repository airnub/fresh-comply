"use client";

import { ReasonDialog } from "./ReasonDialog";
import { useTranslations } from "next-intl";

interface FreshnessActionsProps {
  watcherId: string;
}

export function FreshnessActions({ watcherId }: FreshnessActionsProps) {
  const t = useTranslations("freshness");

  async function log(action: string, reason: string) {
    console.info(`[freshness] ${action} -> ${watcherId}: ${reason}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <ReasonDialog
        title={t("approveTitle")}
        description={t("approveDescription")}
        triggerLabel={t("approve")}
        busyLabel={t("reason.submitting")}
        onSubmit={async (reason) => log("approve", reason)}
      />
      <ReasonDialog
        title={t("rejectTitle")}
        description={t("rejectDescription")}
        triggerLabel={t("reject")}
        busyLabel={t("reason.submitting")}
        onSubmit={async (reason) => log("reject", reason)}
      />
    </div>
  );
}
