import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";

const COOKIES_DOC_URL = "https://github.com/airnub/fresh-comply/blob/main/docs/LEGAL/COOKIES.md";

export default async function CookiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tLegal = await getTranslations({ locale, namespace: "legal" });

  return (
    <Flex direction="column" gap="4">
      <Card asChild variant="surface" size="3">
        <section aria-labelledby="legal-cookies-heading">
          <Flex direction="column" gap="3">
            <Heading id="legal-cookies-heading" size="5">
              {tLegal("cookies.title")}
            </Heading>
            <Text size="2" color="gray">
              {tLegal("cookies.summary")}
            </Text>
            <Button asChild>
              <Link href={COOKIES_DOC_URL} rel="noreferrer noopener" target="_blank">
                {tLegal("cookies.cta")}
              </Link>
            </Button>
          </Flex>
        </section>
      </Card>
    </Flex>
  );
}
