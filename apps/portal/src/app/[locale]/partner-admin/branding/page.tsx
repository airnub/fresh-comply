import { Box, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { getTranslations } from "next-intl/server";
import { loadTenantBrandingSettings } from "../../../server/tenant-admin";
import TenantBrandingForm from "./TenantBrandingForm";

export default async function PartnerBrandingPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "partnerAdmin" });
  const { resolvedBranding, brandingRow, documentBranding } = await loadTenantBrandingSettings();

  return (
    <Card>
      <Flex direction="column" gap="4">
        <Box>
          <Heading size="5">{t("branding.heading")}</Heading>
          <Text as="p" size="3" color="gray">
            {t("branding.intro")}
          </Text>
          {brandingRow?.updated_at ? (
            <Text as="p" size="2" color="gray">
              {t("branding.lastUpdated", { date: new Date(brandingRow.updated_at).toISOString() })}
            </Text>
          ) : null}
        </Box>
        <TenantBrandingForm
          locale={locale}
          initialBranding={resolvedBranding}
          documentBranding={documentBranding}
          copy={{
            labels: {
              logoUrl: t("branding.fields.logoUrl"),
              faviconUrl: t("branding.fields.faviconUrl"),
              primaryColor: t("branding.fields.primaryColor"),
              accentColor: t("branding.fields.accentColor"),
              footerText: t("branding.fields.footerText"),
              headerText: t("branding.fields.headerText"),
              bodyFont: t("branding.fields.bodyFont"),
              headingFont: t("branding.fields.headingFont"),
              pdfFooterText: t("branding.fields.pdfFooterText")
            },
            actions: {
              submit: t("branding.actions.save"),
              saving: t("branding.actions.saving")
            },
            messages: {
              success: t("branding.messages.success"),
              error: t("branding.messages.error")
            }
          }}
        />
      </Flex>
    </Card>
  );
}
