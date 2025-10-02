"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Select } from "@radix-ui/themes";
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

  function handleSelectChange(nextLocale: string) {
    if (!isAppLocale(nextLocale)) return;
    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    const target = replaceLocale(pathname ?? "/", nextLocale);
    startTransition(() => {
      router.replace(target);
    });
  }

  return (
    <Select.Root value={locale} onValueChange={handleSelectChange} disabled={isPending}>
      <Select.Trigger aria-label={t("label")} size="2" />
      <Select.Content position="popper">
        {Object.entries(localeNames).map(([value, label]) => (
          <Select.Item key={value} value={value}>
            {label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}
