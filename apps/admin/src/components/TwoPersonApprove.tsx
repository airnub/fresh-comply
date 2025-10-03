"use client";

import { useId, useState } from "react";

type ApprovalHandler = (payload: { reason: string; approver: string }) => Promise<void> | void;

export interface TwoPersonApproveProps {
  actionLabel: string;
  onApprove: ApprovalHandler;
  approverName?: string;
}

export function TwoPersonApprove({ actionLabel, onApprove, approverName }: TwoPersonApproveProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [approver, setApprover] = useState(approverName ?? "");
  const [submitting, setSubmitting] = useState(false);
  const reasonId = useId();
  const approverId = useId();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onApprove({ reason: reason.trim(), approver: approver.trim() });
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
        className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        onClick={() => setOpen(true)}
      >
        {actionLabel}
      </button>
      {open ? (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-xl">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-gray-900">Confirm second approval</h2>
              <p className="text-sm text-gray-600">
                Provide audit details and confirm the second approver before executing this action.
              </p>
            </header>
            <div className="space-y-2">
              <label htmlFor={approverId} className="text-sm font-medium text-gray-700">
                Approver name
              </label>
              <input
                id={approverId}
                type="text"
                required
                value={approver}
                onChange={(event) => setApprover(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor={reasonId} className="text-sm font-medium text-gray-700">
                Reason for action
              </label>
              <textarea
                id={reasonId}
                required
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
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
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-70"
                disabled={submitting}
              >
                {submitting ? "Processing" : "Approve"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
