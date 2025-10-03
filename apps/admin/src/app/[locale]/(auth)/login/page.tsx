import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { isAdminLocale, locales } from "../../../i18n/config";

export const metadata: Metadata = {
  title: "FreshComply Admin – Sign in",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isAdminLocale(locale)) {
    notFound();
  }

  unstable_setRequestLocale(locale);
  const messages = await getMessages({ locale });
  const t = await getTranslations({ locale, namespace: "auth" });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-600">{t("subtitle")}</p>
        </header>
        <form className="space-y-4" aria-describedby="admin-login-help">
          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
            {t("emailLabel")}
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <p id="admin-login-help" className="text-xs text-gray-500">
            {t("otpNotice")}
          </p>
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {t("submit")}
          </button>
        </form>
        <FooterNote>
          <strong>{t("supportHeadline")}</strong> {t("supportNote")}
        </FooterNote>
      </main>
    </NextIntlClientProvider>
  );
}

function FooterNote({ children }: { children: ReactNode }) {
  return <p className="text-center text-xs text-gray-500">{children}</p>;
}
