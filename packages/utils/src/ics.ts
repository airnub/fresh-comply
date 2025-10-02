export function buildICS({ summary, start, end }: { summary: string; start: Date; end: Date }) {
  const format = (date: Date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `SUMMARY:${summary}`,
    `DTSTART:${format(start)}`,
    `DTEND:${format(end)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\n");
}
