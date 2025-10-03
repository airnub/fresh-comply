"use client";

import { ReasonDialog } from "./ReasonDialog";
import { useTranslations } from "next-intl";

export function CasesActions() {
  const t = useTranslations("cases");

  async function log(action: string, reason: string) {
    console.info(`[cases] ${action}: ${reason}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <ReasonDialog
        title={t("createTitle")}
        description={t("createDescription")}
        triggerLabel={t("actions.create")}
        busyLabel={t("reason.submitting")}
        onSubmit={async (reason) => log("create", reason)}
      />
      <ReasonDialog
        title={t("escalateTitle")}
        description={t("escalateDescription")}
        triggerLabel={t("actions.escalate")}
        busyLabel={t("reason.submitting")}
        onSubmit={async (reason) => log("escalate", reason)}
      />
    </div>
  );
}
