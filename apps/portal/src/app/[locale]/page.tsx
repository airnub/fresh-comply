import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { getDemoRun } from "../../lib/demo-data";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const run = await getDemoRun();
  const tHome = await getTranslations({ locale, namespace: "home" });

  return (
    <Flex direction="column" gap="4">
      <Card asChild variant="surface" size="3">
        <section aria-labelledby="home-welcome-heading">
          <Flex direction="column" gap="3">
            <Heading id="home-welcome-heading" size="5">
              {tHome("welcome")}
            </Heading>
            <Text size="3" color="gray">
              {tHome("intro")}
            </Text>
            <Text size="2" weight="medium" color="gray">
              {tHome("timelinePlural", { count: run.timeline.length })}
            </Text>
            <Flex gap="3" wrap="wrap">
              <Button asChild>
                <Link href={`/${locale}/(workflow)/run/${run.id}`}>
                  {tHome("viewTimeline")}
                </Link>
              </Button>
              <Button asChild variant="surface" color="gray">
                <Link href={`/${locale}/(workflow)/board/${run.id}`}>
                  {tHome("openBoard")}
                </Link>
              </Button>
            </Flex>
          </Flex>
        </section>
      </Card>
      <Card asChild variant="surface" size="3">
        <section aria-labelledby="home-demo-heading">
          <Flex direction="column" gap="3">
            <Heading id="home-demo-heading" size="4">
              {tHome("demoWorkflow")}
            </Heading>
            <Text size="2" color="gray">
              {run.title}
            </Text>
            <Flex asChild direction="column" gap="2">
              <ul>
                {run.timeline.slice(0, 3).map((step) => (
                  <li key={step.id}>
                    <Flex justify="between" align="center">
                      <Text as="span" size="2" weight="medium">
                        {step.title}
                      </Text>
                      <Text as="span" size="2" color="gray">
                        {tHome("status", { status: tHome(`statusLabel.${step.status}` as any) })}
                      </Text>
                    </Flex>
                  </li>
                ))}
              </ul>
            </Flex>
          </Flex>
        </section>
      </Card>
      <Card asChild variant="surface" size="3">
        <section aria-labelledby="home-billing-heading">
          <Flex direction="column" gap="3">
            <Heading id="home-billing-heading" size="4">
              {tHome("billingCardTitle")}
            </Heading>
            <Text size="2" color="gray">
              {tHome("billingCardDescription")}
            </Text>
            <Flex>
              <Button asChild>
                <Link href={`/${locale}/billing`}>{tHome("billingCardCta")}</Link>
              </Button>
            </Flex>
          </Flex>
        </section>
      </Card>
    </Flex>
  );
}
