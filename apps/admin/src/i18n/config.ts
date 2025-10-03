export const locales = ["en-IE", "ga-IE"] as const;
export const defaultLocale = "en-IE" as const;
export type AdminLocale = (typeof locales)[number];

export const localeNames: Record<AdminLocale, string> = {
  "en-IE": "English (Ireland)",
  "ga-IE": "Gaeilge (Éire)",
};

export function isAdminLocale(value: string): value is AdminLocale {
  return (locales as readonly string[]).includes(value);
}
