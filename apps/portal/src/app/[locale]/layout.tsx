import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { Box, Button, Container, Flex, Heading, Link as ThemeLink, Text } from "@radix-ui/themes";
import { ThemeProvider } from "@airnub/ui/ThemeProvider";
import { VisuallyHidden } from "@airnub/ui/A11y";
import { ActingForBanner } from "../../components/acting-for-banner";
import { LocaleSwitcher } from "../../components/LocaleSwitcher";
import { ThemeToggle } from "../../components/ThemeToggle";
import SkipLink from "../../components/SkipLink";
import { locales, isAppLocale } from "../../i18n/config";
import { getActiveUserProfile } from "../../server/supabase";
import { headers } from "next/headers";
import { getTenantBrandingFromHeaders } from "../../lib/tenant-branding";

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
  const headerStore = headers();
  const branding = getTenantBrandingFromHeaders(headerStore);
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }

  unstable_setRequestLocale(locale);
  const messages = await getMessages({ locale });
  const tApp = await getTranslations({ locale, namespace: "app" });
  const tNav = await getTranslations({ locale, namespace: "navigation" });
  const tFooter = await getTranslations({ locale, namespace: "footer" });

  let profile = null;
  try {
    profile = await getActiveUserProfile();
  } catch (error) {
    console.error("Supabase auth unavailable", error);
  }

  if (!profile) {
    redirect(`/auth/sign-in?redirect=${encodeURIComponent(`/${locale}`)}`);
  }

  const userDisplayName = profile.name ?? profile.email;
  const signOutAction = `/auth/sign-out?redirect=${encodeURIComponent(`/${locale}`)}`;
  const brandTitle = (branding.pdfHeader?.text as string | undefined) ?? tApp("title");
  const brandLogo = branding.logoUrl ?? undefined;

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
        <Box minHeight="100vh" display="flex" flexDirection="column">
          <Box asChild>
            <header>
              <Box py="4" style={{ borderBottom: "1px solid var(--gray-a4)" }}>
                <Container size="3">
                    <Flex align="center" justify="between" gap="4" wrap="wrap">
                      <Box>
                        <ThemeLink asChild underline="never" color="blue">
                          <Link href={`/${locale}`}>
                            <Flex align="center" gap="3">
                              {brandLogo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={brandLogo}
                                  alt={`${brandTitle} logo`}
                                  style={{ height: "32px", width: "auto" }}
                                />
                              ) : null}
                              <Heading size="5">{brandTitle}</Heading>
                            </Flex>
                        </Link>
                      </ThemeLink>
                      <Text as="p" size="2" color="gray">
                        {tApp("tagline")}
                      </Text>
                      </Box>
                      <Flex align="center" gap="3" wrap="wrap">
                        <Text size="2" color="gray">
                          {tApp("signedInAs", { user: userDisplayName })}
                        </Text>
                        <form action={signOutAction} method="post">
                          <Button type="submit" variant="ghost" color="gray" size="2">
                            {tApp("signOut")}
                          </Button>
                        </form>
                        <LocaleSwitcher />
                        <ThemeToggle />
                      </Flex>
                    </Flex>
                  </Container>
              </Box>
            </header>
          </Box>
          <Box asChild flexGrow="1">
            <main id="main-content" tabIndex={-1}>
              <Container size="3" py="5">
                <Flex direction="column" gap="5">
                  <ActingForBanner engager="Company A" client="Company X" />
                  {children}
                </Flex>
              </Container>
            </main>
          </Box>
          <Box asChild>
            <footer>
              <Box py="4" style={{ borderTop: "1px solid var(--gray-a4)" }}>
                <Container size="3">
                  <Flex align="center" justify="between" gap="3" wrap="wrap">
                    <Flex asChild gap="3" wrap="wrap">
                      <nav aria-label={tFooter("legal")}>
                        {legalLinks.map((link) => (
                          <ThemeLink key={link.href} asChild underline="always" color="blue">
                            <Link href={link.href}>{link.label}</Link>
                          </ThemeLink>
                        ))}
                      </nav>
                    </Flex>
                    <VisuallyHidden>{tFooter("accessibility")}</VisuallyHidden>
                    <Text size="2" color="gray">
                      © {new Date().getFullYear()} FreshComply • {tFooter("gdprReady")}
                    </Text>
                  </Flex>
                </Container>
              </Box>
            </footer>
          </Box>
        </Box>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
