import { getTranslations } from "next-intl/server";
import { Badge, Card, Flex, Heading, Separator, Text } from "@radix-ui/themes";
import { loadTenantBillingOverview } from "../../../server/billing";

function formatCurrency(amount: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase()
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

function formatDate(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function BillingPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "billing" });
  const { overview } = await loadTenantBillingOverview();

  const statusKey = (overview?.status ?? "unknown") as
    | "trialing"
    | "active"
    | "incomplete"
    | "incomplete_expired"
    | "past_due"
    | "canceled"
    | "unpaid"
    | "paused"
    | "unknown";
  const statusLabel = t(`status.${statusKey}`);
  const billingModeLabel = t(`mode.${(overview?.billing_mode ?? "direct") as "direct" | "partner_managed"}`);
  const latestUpdate = overview?.subscription_updated_at ?? overview?.tenant_updated_at ?? null;
  const priceAmount =
    overview?.unit_amount != null && overview?.currency
      ? formatCurrency(overview.unit_amount / 100, overview.currency, locale)
      : null;
  const nextRenewal = overview?.current_period_end
    ? formatDate(overview.current_period_end, locale)
    : t("subscription.noRenewal");
  const collectionMethodKey = (overview?.collection_method ?? "charge_automatically") as
    | "charge_automatically"
    | "send_invoice";
  const collectionMethodLabel = t(`collection.${collectionMethodKey}`);
  const intervalKey = overview?.interval ?? null;
  const intervalLabel = intervalKey
    ? t(`plan.intervalLabels.${intervalKey as "day" | "week" | "month" | "year"}`)
    : null;

  return (
    <Flex direction="column" gap="4">
      <Flex direction="column" gap="2">
        <Heading size="6">{t("title")}</Heading>
        <Text color="gray" size="3">
          {t("description")}
        </Text>
        {latestUpdate ? (
          <Text color="gray" size="2">
            {t("lastUpdated", { date: new Date(latestUpdate) })}
          </Text>
        ) : null}
      </Flex>

      {overview ? (
        <Flex direction="column" gap="4">
          <Card variant="surface">
            <Flex direction="column" gap="3">
              <Flex align="center" justify="between" gap="3" wrap="wrap">
                <Heading size="5">{t("subscription.heading")}</Heading>
                <Badge color={statusKey === "active" ? "green" : statusKey === "trialing" ? "blue" : "amber"}>
                  {statusLabel}
                </Badge>
              </Flex>
              <Separator size="4" />
              <Flex direction="column" gap="2">
                <Text size="3">
                  <strong>{t("subscription.customerId")}:</strong> {overview.stripe_customer_id ?? t("subscription.missing")}
                </Text>
                <Text size="3">
                  <strong>{t("subscription.subscriptionId")}:</strong> {overview.stripe_subscription_id ?? t("subscription.missing")}
                </Text>
                <Text size="3">
                  <strong>{t("subscription.billingMode")}:</strong> {billingModeLabel}
                </Text>
                <Text size="3">
                  <strong>{t("subscription.collection")}:</strong> {collectionMethodLabel}
                </Text>
                <Text size="3">
                  <strong>{t("subscription.nextRenewal")}:</strong> {nextRenewal}
                </Text>
                <Text size="3">
                  <strong>{t("subscription.cancelAtPeriodEnd")}:</strong> {overview.cancel_at_period_end ? t("boolean.yes") : t("boolean.no")}
                </Text>
              </Flex>
            </Flex>
          </Card>

          <Card variant="surface">
            <Flex direction="column" gap="3">
              <Heading size="5">{t("plan.heading")}</Heading>
              <Separator size="4" />
              <Flex direction="column" gap="2">
                <Text size="3">
                  <strong>{t("plan.name")}:</strong> {overview.product_name ?? t("plan.unknown")}
                </Text>
                <Text size="3">
                  <strong>{t("plan.nickname")}:</strong> {overview.nickname ?? t("plan.unknown")}
                </Text>
                <Text size="3">
                  <strong>{t("plan.amount")}:</strong> {priceAmount ?? t("plan.pending")}
                </Text>
                <Text size="3">
                  <strong>{t("plan.interval")}:</strong>{" "}
                  {intervalLabel
                    ? t("plan.recurring", {
                        count: overview.interval_count ?? 1,
                        interval: intervalLabel
                      })
                    : t("plan.oneTime")}
                </Text>
                <Text size="3">
                  <strong>{t("plan.active")}:</strong> {overview.price_active ? t("boolean.yes") : t("boolean.no")}
                </Text>
              </Flex>
            </Flex>
          </Card>
        </Flex>
      ) : (
        <Card variant="surface">
          <Flex direction="column" gap="3">
            <Heading size="5">{t("empty.heading")}</Heading>
            <Text size="3" color="gray">
              {t("empty.body")}
            </Text>
          </Flex>
        </Card>
      )}
    </Flex>
  );
}

export const dynamic = "force-dynamic";
