import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";

const PRIVACY_DOC_URL = "https://github.com/airnub/fresh-comply/blob/main/docs/compliance/privacy.v1.0.0.md";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tLegal = await getTranslations({ locale, namespace: "legal" });

  return (
    <Flex direction="column" gap="4">
      <Card asChild variant="surface" size="3">
        <section aria-labelledby="legal-privacy-heading">
          <Flex direction="column" gap="3">
            <Heading id="legal-privacy-heading" size="5">
              {tLegal("privacy.title")}
            </Heading>
            <Text size="2" color="gray">
              {tLegal("privacy.summary")}
            </Text>
            <Text size="2" color="gray">
              {tLegal("privacy.updated", { date: new Date("2025-10-02") })}
            </Text>
            <Button asChild>
              <Link href={PRIVACY_DOC_URL} rel="noreferrer noopener" target="_blank">
                {tLegal("privacy.cta")}
              </Link>
            </Button>
          </Flex>
        </section>
      </Card>
    </Flex>
  );
}
