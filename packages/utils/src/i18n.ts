export type DateTimeFormatOptions = Intl.DateTimeFormatOptions & { timeZone?: string };

export function formatDateTime(
  value: string | number | Date,
  locale: string,
  options: DateTimeFormatOptions = {}
) {
  const formatter = new Intl.DateTimeFormat(locale, {
    ...options,
    dateStyle: options.dateStyle ?? "medium",
    timeStyle: options.timeStyle ?? "short"
  });
  return formatter.format(typeof value === "string" || typeof value === "number" ? new Date(value) : value);
}

export function formatDate(value: string | number | Date, locale: string, options: DateTimeFormatOptions = {}) {
  const formatter = new Intl.DateTimeFormat(locale, {
    ...options,
    dateStyle: options.dateStyle ?? "long"
  });
  return formatter.format(typeof value === "string" || typeof value === "number" ? new Date(value) : value);
}

export function formatCurrency(value: number, locale: string, currency: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
}

export function formatNumber(value: number, locale: string, options: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat(locale, options).format(value);
}
