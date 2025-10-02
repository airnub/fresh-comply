import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";

const SUBPROCESSORS_DOC_URL = "https://github.com/airnub/fresh-comply/blob/main/docs/LEGAL/SUBPROCESSORS.md";

export default async function SubprocessorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tLegal = await getTranslations({ locale, namespace: "legal" });

  return (
    <Flex direction="column" gap="4">
      <Card asChild variant="surface" size="3">
        <section aria-labelledby="legal-subprocessors-heading">
          <Flex direction="column" gap="3">
            <Heading id="legal-subprocessors-heading" size="5">
              {tLegal("subprocessors.title")}
            </Heading>
            <Text size="2" color="gray">
              {tLegal("subprocessors.summary")}
            </Text>
            <Button asChild>
              <Link href={SUBPROCESSORS_DOC_URL} rel="noreferrer noopener" target="_blank">
                {tLegal("subprocessors.cta")}
              </Link>
            </Button>
          </Flex>
        </section>
      </Card>
    </Flex>
  );
}
