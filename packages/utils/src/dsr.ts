export const DSR_REQUEST_TYPES = [
  "access",
  "export",
  "rectification",
  "erasure",
  "restriction",
  "objection",
  "portability"
] as const;

export type DsrRequestType = (typeof DSR_REQUEST_TYPES)[number];

export const DSR_REQUEST_STATUSES = [
  "received",
  "acknowledged",
  "in_progress",
  "paused",
  "completed",
  "escalated"
] as const;

export type DsrRequestStatus = (typeof DSR_REQUEST_STATUSES)[number];

export function isDsrRequestType(value: string | null | undefined): value is DsrRequestType {
  if (!value) return false;
  return (DSR_REQUEST_TYPES as readonly string[]).includes(value.toLowerCase());
}

export function calculateAckDeadline(receivedAt: Date): Date {
  const deadline = new Date(receivedAt.getTime());
  deadline.setHours(deadline.getHours() + 72);
  return deadline;
}

export function calculateResolutionDeadline(receivedAt: Date): Date {
  const deadline = new Date(receivedAt.getTime());
  deadline.setDate(deadline.getDate() + 30);
  return deadline;
}
