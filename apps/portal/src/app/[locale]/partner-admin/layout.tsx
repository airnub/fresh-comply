import type { ReactNode } from "react";
import { Box, Container, Flex, Heading, Text } from "@radix-ui/themes";
import { getTranslations } from "next-intl/server";
import PartnerAdminNav from "./PartnerAdminNav";

export default async function PartnerAdminLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "partnerAdmin" });

  const links = [
    { href: `/${locale}/partner-admin/branding`, label: t("nav.branding") },
    { href: `/${locale}/partner-admin/domains`, label: t("nav.domains") }
  ];

  return (
    <Box py="5">
      <Container size="3">
        <Flex direction="column" gap="4">
          <Box>
            <Heading size="7">{t("title")}</Heading>
            <Text as="p" size="3" color="gray">
              {t("description")}
            </Text>
          </Box>
          <PartnerAdminNav links={links} />
          <Box>{children}</Box>
        </Flex>
      </Container>
    </Box>
  );
}
