import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";

const TERMS_DOC_URL = "https://github.com/airnub/fresh-comply/blob/main/docs/compliance/terms.v1.0.0.md";

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tLegal = await getTranslations({ locale, namespace: "legal" });

  return (
    <Flex direction="column" gap="4">
      <Card asChild variant="surface" size="3">
        <section aria-labelledby="legal-terms-heading">
          <Flex direction="column" gap="3">
            <Heading id="legal-terms-heading" size="5">
              {tLegal("terms.title")}
            </Heading>
            <Text size="2" color="gray">
              {tLegal("terms.summary")}
            </Text>
            <Button asChild>
              <Link href={TERMS_DOC_URL} rel="noreferrer noopener" target="_blank">
                {tLegal("terms.cta")}
              </Link>
            </Button>
          </Flex>
        </section>
      </Card>
    </Flex>
  );
}
