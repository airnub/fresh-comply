import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { unstable_setRequestLocale } from "next-intl/server";
import { isAdminLocale, locales } from "../i18n/config";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isAdminLocale(locale)) {
    notFound();
  }

  unstable_setRequestLocale(locale);

  return <>{children}</>;
}
