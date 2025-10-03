import { Box, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { getTranslations } from "next-intl/server";
import { loadTenantDomains } from "../../../server/tenant-admin";
import TenantDomainsPanel from "./TenantDomainsPanel";

export default async function PartnerDomainsPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "partnerAdmin" });
  const { domains } = await loadTenantDomains();

  return (
    <Card>
      <Flex direction="column" gap="4">
        <Box>
          <Heading size="5">{t("domains.heading")}</Heading>
          <Text as="p" size="3" color="gray">
            {t("domains.intro")}
          </Text>
        </Box>
        <TenantDomainsPanel
          initialDomains={domains}
          copy={{
            labels: {
              domain: t("domains.fields.domain"),
              status: t("domains.table.status"),
              verifiedAt: t("domains.table.verifiedAt"),
              actions: t("domains.table.actions")
            },
            actions: {
              add: t("domains.actions.add"),
              verify: t("domains.actions.verify"),
              setPrimary: t("domains.actions.setPrimary"),
              remove: t("domains.actions.remove")
            },
            messages: {
              added: t("domains.messages.added"),
              verified: t("domains.messages.verified"),
              removed: t("domains.messages.removed"),
              error: t("domains.messages.error"),
              empty: t("domains.messages.empty"),
              primary: t("domains.messages.primary")
            }
          }}
        />
      </Flex>
    </Card>
  );
}
