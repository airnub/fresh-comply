"use client";

import { ReasonDialog } from "./ReasonDialog";
import { TwoPersonApprove } from "./TwoPersonApprove";
import { useTranslations } from "next-intl";

interface RunActionsPanelProps {
  runId: string;
}

export function RunActionsPanel({ runId }: RunActionsPanelProps) {
  const t = useTranslations("runs");

  async function logAction(action: string, payload: string) {
    console.info(`[admin] ${action} requested for ${runId}: ${payload}`);
  }

  return (
    <div className="space-y-3">
      <ReasonDialog
        title={t("reason.reassignTitle")}
        description={t("reason.reassignDescription")}
        triggerLabel={t("actions.reassign")}
        busyLabel={t("reason.submitting")}
        onSubmit={async (reason) => {
          await logAction("reassign", reason);
        }}
      />
      <ReasonDialog
        title={t("reason.dueTitle")}
        description={t("reason.dueDescription")}
        triggerLabel={t("actions.due")}
        busyLabel={t("reason.submitting")}
        onSubmit={async (reason) => {
          await logAction("due", reason);
        }}
      />
      <ReasonDialog
        title={t("reason.statusTitle")}
        description={t("reason.statusDescription")}
        triggerLabel={t("actions.status")}
        busyLabel={t("reason.submitting")}
        onSubmit={async (reason) => {
          await logAction("status", reason);
        }}
      />
      <ReasonDialog
        title={t("reason.regenerateTitle")}
        description={t("reason.regenerateDescription")}
        triggerLabel={t("actions.regenerate")}
        busyLabel={t("reason.submitting")}
        onSubmit={async (reason) => {
          await logAction("regenerate", reason);
        }}
      />
      <ReasonDialog
        title={t("reason.digestTitle")}
        description={t("reason.digestDescription")}
        triggerLabel={t("actions.digest")}
        busyLabel={t("reason.submitting")}
        onSubmit={async (reason) => {
          await logAction("digest", reason);
        }}
      />
      <TwoPersonApprove
        actionLabel={t("actions.cancel")}
        onApprove={async ({ reason, approver }) => {
          await logAction("cancel", `${approver}:${reason}`);
        }}
      />
    </div>
  );
}
