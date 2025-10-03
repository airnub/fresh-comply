"use client";

import { ReasonDialog } from "./ReasonDialog";
import { useTranslations } from "next-intl";

export function DsrActions() {
  const t = useTranslations("dsr");

  async function log(action: string, reason: string) {
    console.info(`[dsr] ${action}: ${reason}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <ReasonDialog
        title={t("ackTitle")}
        description={t("ackDescription")}
        triggerLabel={t("actions.acknowledge")}
        busyLabel={t("reason.submitting")}
        onSubmit={async (reason) => log("acknowledge", reason)}
      />
      <ReasonDialog
        title={t("exportTitle")}
        description={t("exportDescription")}
        triggerLabel={t("actions.export")}
        busyLabel={t("reason.submitting")}
        onSubmit={async (reason) => log("export", reason)}
      />
      <ReasonDialog
        title={t("eraseTitle")}
        description={t("eraseDescription")}
        triggerLabel={t("actions.erase")}
        busyLabel={t("reason.submitting")}
        onSubmit={async (reason) => log("erase", reason)}
      />
    </div>
  );
}
