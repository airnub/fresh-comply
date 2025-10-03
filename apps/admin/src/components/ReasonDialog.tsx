"use client";

import { useId, useState } from "react";

type SubmitHandler = (reason: string) => Promise<void> | void;

export interface ReasonDialogProps {
  title: string;
  description?: string;
  onSubmit: SubmitHandler;
  triggerLabel: string;
  busyLabel?: string;
}

export function ReasonDialog({ title, description, onSubmit, triggerLabel, busyLabel }: ReasonDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const reasonId = useId();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(reason.trim());
      setOpen(false);
      setReason("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>
      {open ? (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-xl">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              {description ? <p className="text-sm text-gray-600">{description}</p> : null}
            </header>
            <label htmlFor={reasonId} className="block text-sm font-medium text-gray-700">
              Reason
            </label>
            <textarea
              id={reasonId}
              name="reason"
              required
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-70"
                disabled={submitting}
              >
                {submitting ? busyLabel ?? "Submitting" : "Submit"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
