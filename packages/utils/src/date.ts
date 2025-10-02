export function formatDueDate(date?: string | Date): string {
  if (!date) return "No due date";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
