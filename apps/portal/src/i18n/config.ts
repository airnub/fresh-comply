export const locales = ["en-IE", "ga-IE"] as const;
export const defaultLocale = "en-IE" as const;
export type AppLocale = (typeof locales)[number];

export const localeNames: Record<AppLocale, string> = {
  "en-IE": "English (Ireland)",
  "ga-IE": "Gaeilge (Éire)"
};

export function isAppLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value);
}
