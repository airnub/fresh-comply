"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition, useId, type ChangeEvent } from "react";
import { localeNames, type AppLocale, isAppLocale } from "../i18n/config";
import { localeCookieName } from "../i18n/request";

function replaceLocale(pathname: string, locale: AppLocale) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return `/${locale}`;
  }
  if (isAppLocale(segments[0])) {
    segments[0] = locale;
    return `/${segments.join("/")}`;
  }
  return `/${locale}/${segments.join("/")}`;
}

export function LocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("localeSwitcher");
  const [isPending, startTransition] = useTransition();
  const selectId = useId();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value;
    if (!isAppLocale(nextLocale)) return;
    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    const target = replaceLocale(pathname ?? "/", nextLocale);
    startTransition(() => {
      router.replace(target);
    });
  }

  return (
    <label className="text-sm font-medium" htmlFor={selectId}>
      <span className="sr-only">{t("label")}</span>
      <select
        id={selectId}
        className="rounded border border-subtle bg-surface px-3 py-2"
        value={locale}
        aria-label={t("label")}
        onChange={handleChange}
        disabled={isPending}
      >
        {Object.entries(localeNames).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
