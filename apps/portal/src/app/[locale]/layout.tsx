import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { ThemeProvider } from "@airnub/ui/ThemeProvider";
import { ActingForBanner } from "../../components/acting-for-banner";
import { LocaleSwitcher } from "../../components/LocaleSwitcher";
import { ThemeToggle } from "../../components/ThemeToggle";
import SkipLink from "../../components/SkipLink";
import { locales, isAppLocale } from "../../i18n/config";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }

  unstable_setRequestLocale(locale);
  const messages = await getMessages({ locale });
  const tApp = await getTranslations({ locale, namespace: "app" });
  const tNav = await getTranslations({ locale, namespace: "navigation" });
  const tFooter = await getTranslations({ locale, namespace: "footer" });

  const legalLinks: { href: string; label: string }[] = [
    { href: `/${locale}/privacy`, label: tNav("privacy") },
    { href: `/${locale}/terms`, label: tNav("terms") },
    { href: `/${locale}/subprocessors`, label: tNav("subprocessors") },
    { href: `/${locale}/cookies`, label: tNav("cookies") }
  ];

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Europe/Dublin">
      <ThemeProvider>
        <SkipLink href="#main-content">{tApp("skipToContent")}</SkipLink>
        <div className="flex min-h-screen flex-col">
          <header className="border-b p-3">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
              <div>
                <Link href={`/${locale}`} className="text-2xl font-semibold text-foreground">
                  {tApp("title")}
                </Link>
                <p className="text-sm text-muted-foreground">{tApp("tagline")}</p>
              </div>
              <div className="flex items-center gap-4">
                <LocaleSwitcher />
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 p-6" tabIndex={-1}>
            <ActingForBanner engager="Company A" client="Company X" />
            {children}
          </main>
          <footer className="border-t bg-surface-alt p-6">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <nav aria-label={tFooter("legal")} className="flex flex-wrap gap-2">
                {legalLinks.map((link) => (
                  <Link key={link.href} href={link.href} className="underline">
                    {link.label}
                  </Link>
                ))}
              </nav>
              <span className="sr-only">{tFooter("accessibility")}</span>
              <p>© {new Date().getFullYear()} FreshComply • {tFooter("gdprReady")}</p>
            </div>
          </footer>
        </div>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
