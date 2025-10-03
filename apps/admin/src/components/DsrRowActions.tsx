"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ReasonDialog } from "./ReasonDialog";
import { completeDsrRequest, reassignDsrRequest, togglePauseDsrRequest } from "../app/[locale]/dsr/actions";

interface DsrRowActionsProps {
  requestId: string;
  status: string;
  assigneeEmail: string | null;
}

interface ReassignPayload {
  email: string;
  reason: string;
}

function ReassignDialog({ onSubmit, disabled, busyLabel }: {
  onSubmit: (payload: ReassignPayload) => Promise<void>;
  disabled?: boolean;
  busyLabel?: string;
}) {
  const t = useTranslations("dsr");
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ email, reason });
      setOpen(false);
      setEmail("");
      setReason("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        {t("actions.reassign")}
      </button>
      {open ? (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-xl">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-gray-900">{t("dialogs.reassign.title")}</h2>
              <p className="text-sm text-gray-600">{t("dialogs.reassign.description")}</p>
            </header>
            <label className="block text-sm font-medium text-gray-700">
              {t("dialogs.reassign.emailLabel")}
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              {t("dialogs.reassign.reasonLabel")}
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                {t("dialogs.cancel")}
              </button>
              <button
                type="submit"
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-70"
                disabled={submitting}
              >
                {submitting ? busyLabel ?? t("dialogs.submitting") : t("dialogs.reassign.submit")}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

export function DsrRowActions({ requestId, status, assigneeEmail }: DsrRowActionsProps) {
  const t = useTranslations("dsr");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const isCompleted = status === "completed";
  const isPaused = status === "paused";

  function handleResult(result: Awaited<ReturnType<typeof completeDsrRequest>>) {
    if (!result.ok) {
      setError(resolveError(result.error));
      setMessage(null);
    } else {
      setMessage(t("messages.updated"));
      setError(null);
    }
  }

  function resolveError(code?: string | null) {
    switch (code) {
      case "invalid_email":
        return t("messages.invalidEmail");
      case "not_member":
        return t("messages.notMember");
      case "not_found":
        return t("messages.notFound");
      case "already_completed":
        return t("messages.alreadyCompleted");
      case "supabase_unavailable":
        return t("messages.supabaseUnavailable");
      default:
        return t("messages.error");
    }
  }

  async function runAction(action: () => Promise<Awaited<ReturnType<typeof completeDsrRequest>>>, key: string) {
    setBusyAction(key);
    try {
      const result = await action();
      handleResult(result);
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <ReassignDialog
          onSubmit={(payload) => runAction(() => reassignDsrRequest(requestId, payload.email, payload.reason), "reassign")}
          disabled={busyAction !== null || isCompleted}
          busyLabel={t("dialogs.submitting")}
        />
        <ReasonDialog
          title={t("dialogs.complete.title")}
          description={t("dialogs.complete.description")}
          triggerLabel={t("actions.complete")}
          busyLabel={t("dialogs.submitting")}
          disabled={isCompleted || busyAction !== null}
          onSubmit={(reason) => runAction(() => completeDsrRequest(requestId, reason), "complete")}
        />
        <ReasonDialog
          title={isPaused ? t("dialogs.resume.title") : t("dialogs.pause.title")}
          description={isPaused ? t("dialogs.resume.description") : t("dialogs.pause.description")}
          triggerLabel={isPaused ? t("actions.resume") : t("actions.pause")}
          busyLabel={t("dialogs.submitting")}
          disabled={isCompleted || busyAction !== null}
          onSubmit={(reason) => runAction(() => togglePauseDsrRequest(requestId, reason), "pause")}
        />
      </div>
      <div className="text-xs text-gray-500">
        {assigneeEmail ? t("assignee", { email: assigneeEmail }) : t("assigneeUnassigned")}
      </div>
      {message ? <p className="text-xs text-green-600">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
