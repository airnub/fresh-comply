"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ReasonDialog } from "./ReasonDialog";
import { useTranslations } from "next-intl";
import type { SourceDiff } from "@airnub/freshness/watcher";
import { approvePendingUpdate, rejectPendingUpdate } from "../app/[locale]/freshness/actions";

interface FreshnessActionsProps {
  watcherId: string;
  status: "pending" | "approved" | "rejected";
  diff: SourceDiff;
}

export function FreshnessActions({ watcherId, status, diff }: FreshnessActionsProps) {
  const t = useTranslations("freshness");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const disabled = status !== "pending";

  const diffSummary = useMemo(() => {
    const parts = [] as string[];
    if (diff.added.length) parts.push(t("diffAdded", { count: diff.added.length }));
    if (diff.removed.length) parts.push(t("diffRemoved", { count: diff.removed.length }));
    if (diff.changed.length) parts.push(t("diffUpdated", { count: diff.changed.length }));
    return parts.length ? parts.join(" · ") : t("diffNoop");
  }, [diff.added.length, diff.changed.length, diff.removed.length, t]);

  async function handleModeration(
    action: "approve" | "reject",
    reason: string
  ): Promise<void> {
    setError(null);
    startTransition(async () => {
      const result =
        action === "approve"
          ? await approvePendingUpdate(watcherId, reason)
          : await rejectPendingUpdate(watcherId, reason);
      if (!result.ok) {
        setError(result.error ?? t("error.generic"));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">{diffSummary}</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <ReasonDialog
          title={t("approveTitle")}
          description={t("approveDescription")}
          triggerLabel={t("approve")}
          busyLabel={t("reason.submitting")}
          disabled={disabled || isPending}
          onSubmit={async (reason) => handleModeration("approve", reason)}
        />
        <ReasonDialog
          title={t("rejectTitle")}
          description={t("rejectDescription")}
          triggerLabel={t("reject")}
          busyLabel={t("reason.submitting")}
          disabled={disabled || isPending}
          onSubmit={async (reason) => handleModeration("reject", reason)}
        />
      </div>
      {disabled ? (
        <p className="text-xs text-gray-500">{t("locked", { status: t(`statuses.${status}` as const) })}</p>
      ) : isPending ? (
        <p className="text-xs text-gray-500">{t("reason.submitting")}</p>
      ) : null}
    </div>
  );
}
