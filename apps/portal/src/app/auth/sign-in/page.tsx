import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Box, Card, Container, Flex, Heading, Text } from "@radix-ui/themes";
import { ThemeProvider } from "@airnub/ui/ThemeProvider";
import { SignInForm } from "../../../components/sign-in-form";
import { defaultLocale, isAppLocale } from "../../../i18n/config";
import { ensureLeadingLocale } from "../../../i18n/request";
import { getActiveUserProfile } from "../../../server/supabase";

type PageProps = {
  searchParams: Promise<{ redirectTo?: string }>;
};

function sanitizeRedirect(target?: string | null) {
  if (!target) return `/${defaultLocale}`;
  if (!target.startsWith("/") || target.startsWith("//")) {
    return `/${defaultLocale}`;
  }
  return target;
}

async function resolveDestinationLabel(path: string) {
  const tNav = await getTranslations({ locale: defaultLocale, namespace: "navigation" });
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) {
    return tNav("home");
  }

  const [maybeLocale, ...rest] = segments;
  const locale = isAppLocale(maybeLocale) ? maybeLocale : defaultLocale;
  const section = isAppLocale(maybeLocale) ? rest[0] : maybeLocale;

  const dictionary: Record<string, string> = {
    home: tNav("home"),
    privacy: tNav("privacy"),
    terms: tNav("terms"),
    subprocessors: tNav("subprocessors"),
    cookies: tNav("cookies")
  };

  return dictionary[section ?? ""] ?? ensureLeadingLocale("", locale);
}

export default async function SignInPage({ searchParams }: PageProps) {
  const { redirectTo } = await searchParams;
  const sanitizedRedirect = sanitizeRedirect(redirectTo);
  const destinationLabel = await resolveDestinationLabel(sanitizedRedirect);
  const messages = await getMessages({ locale: defaultLocale });
  const tAuth = await getTranslations({ locale: defaultLocale, namespace: "auth" });

  try {
    const profile = await getActiveUserProfile();
    if (profile) {
      redirect(sanitizedRedirect);
    }
  } catch (error) {
    console.error("Supabase auth unavailable", error);
  }

  return (
    <NextIntlClientProvider locale={defaultLocale} messages={messages} timeZone="Europe/Dublin">
      <ThemeProvider>
        <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center">
          <Container size="2">
            <Card asChild size="4" variant="surface">
              <section aria-labelledby="sign-in-heading">
                <Flex direction="column" gap="4">
                  <Flex direction="column" gap="2">
                    <Heading id="sign-in-heading" size="6">
                      {tAuth("title")}
                    </Heading>
                    <Text size="3" color="gray">
                      {tAuth("description")}
                    </Text>
                  </Flex>
                  <SignInForm redirectTo={sanitizedRedirect} destinationLabel={destinationLabel} />
                </Flex>
              </section>
            </Card>
          </Container>
        </Box>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
