import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "../../../components/AdminShell";
import { getSupabaseUser } from "../../../lib/auth/supabase-ssr";
import { requireRole, type AdminRole } from "../../../lib/rbac";
import { isAdminLocale, locales } from "../../../i18n/config";

const navigation = [
  { href: "", messageKey: "dashboard" },
  { href: "/search", messageKey: "search" },
  { href: "/runs", messageKey: "runs" },
  { href: "/freshness", messageKey: "freshness" },
  { href: "/orgs", messageKey: "orgs" },
  { href: "/dsr", messageKey: "dsr" },
  { href: "/cases", messageKey: "cases" }
] as const;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export default async function DashboardLayout({
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
  let user = null;
  try {
    user = await getSupabaseUser();
  } catch (error) {
    console.warn("Supabase auth unavailable for admin layout", error);
  }

  if (!user) {
    redirect(`/${locale}/(auth)/login`);
  }

  const role = (user.app_metadata?.admin_role ?? user.user_metadata?.admin_role) as AdminRole | undefined;
  if (!role) {
    redirect(`/${locale}/(auth)/login`);
  }

  requireRole({ role }, ["platform_admin", "support_agent", "compliance_moderator", "dpo"]);

  const messages = await getMessages({ locale });
  const tNav = await getTranslations({ locale, namespace: "navigation" });

  const enrichedNav = navigation.map((item) => ({
    href: item.href,
    label: tNav(item.messageKey),
  }));

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AdminShell navigation={enrichedNav}>
        {children}
      </AdminShell>
    </NextIntlClientProvider>
  );
}
