import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Table,
  Text,
  TextField
} from "@radix-ui/themes";
import { extractFilterOptions, listFundingOpportunities } from "../../../server/funding";
import { SupabaseConfigurationError } from "../../../server/supabase";

type PageParams = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parseParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return search.toString();
}

function formatCurrency(amount: number | null | undefined, currency: string | null | undefined) {
  if (typeof amount !== "number") return null;
  const formatter = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: currency ?? "EUR",
    maximumFractionDigits: 0
  });
  return formatter.format(amount);
}

export default async function FundingPage({ params, searchParams }: PageParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "funding" });
  const currentSearch = await searchParams;
  const search = parseParam(currentSearch?.search);
  const domain = parseParam(currentSearch?.domain);
  const county = parseParam(currentSearch?.county);
  const callYearValue = parseParam(currentSearch?.callYear);
  const callYear = callYearValue ? Number.parseInt(callYearValue, 10) : undefined;

  let opportunities: Awaited<ReturnType<typeof listFundingOpportunities>>["opportunities"] = [];
  let total = 0;
  let loadError: Error | null = null;

  try {
    const result = await listFundingOpportunities({
      search: search ?? undefined,
      domain: domain ?? undefined,
      county: county ?? undefined,
      callYear: Number.isFinite(callYear) ? callYear : undefined,
      limit: 100
    });
    opportunities = result.opportunities;
    total = result.total;
  } catch (error) {
    loadError = error as Error;
  }

  const baseDataset = await listFundingOpportunities({ limit: 250 });
  const filters = extractFilterOptions(baseDataset.opportunities);
  const calendarQuery = buildQuery({
    domain: domain ?? undefined,
    county: county ?? undefined,
    callYear: callYearValue ?? undefined
  });
  const calendarHref = calendarQuery ? `/api/funding/calendar?${calendarQuery}` : "/api/funding/calendar";

  return (
    <Flex direction="column" gap="4">
      <Card variant="surface" size="3">
        <Flex direction="column" gap="3">
          <Heading size="6">{t("heading")}</Heading>
          <Text size="3" color="gray">
            {t("description")}
          </Text>
          <Flex asChild>
            <form method="get">
              <Flex direction="column" gap="3">
                <Flex gap="3" wrap="wrap">
                  <Box minWidth="220px">
                    <TextField.Root
                      name="search"
                      defaultValue={search ?? ""}
                      placeholder={t("searchPlaceholder")}
                      aria-label={t("searchPlaceholder")}
                    />
                  </Box>
                  <Box minWidth="180px">
                    <select
                      id="funding-domain"
                      name="domain"
                      defaultValue={domain ?? ""}
                      className="rt-SelectTrigger"
                      aria-label={t("filters.domain")}
                    >
                      <option value="">{t("filters.domain")}</option>
                      {filters.domains.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </Box>
                  <Box minWidth="180px">
                    <select
                      id="funding-county"
                      name="county"
                      defaultValue={county ?? ""}
                      className="rt-SelectTrigger"
                      aria-label={t("filters.county")}
                    >
                      <option value="">{t("filters.county")}</option>
                      {filters.counties.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </Box>
                  <Box minWidth="160px">
                    <select
                      id="funding-year"
                      name="callYear"
                      defaultValue={callYearValue ?? ""}
                      className="rt-SelectTrigger"
                      aria-label={t("filters.year")}
                    >
                      <option value="">{t("filters.year")}</option>
                      {filters.years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </Box>
                </Flex>
                <Flex gap="3" wrap="wrap">
                  <Button type="submit">{t("filters.submit")}</Button>
                  <Button asChild variant="surface" color="gray">
                    <Link href={`/${locale}/funding`}>{t("filters.reset")}</Link>
                  </Button>
                  <Button asChild variant="surface">
                    <Link href={calendarHref}>{t("calendarExport")}</Link>
                  </Button>
                </Flex>
              </Flex>
            </form>
          </Flex>
        </Flex>
      </Card>
      <Card variant="classic" size="3">
        <Flex direction="column" gap="3">
          <Flex align="center" justify="between">
            <Heading size="4">{t("totalResults", { count: total })}</Heading>
            <Badge variant="solid" color="green">
              {total}
            </Badge>
          </Flex>
          {loadError ? (
            <Text color="red" size="3">
              {loadError instanceof SupabaseConfigurationError ? loadError.message : t("loadError")}
            </Text>
          ) : opportunities.length === 0 ? (
            <Text size="3" color="gray">
              {t("noResults")}
            </Text>
          ) : (
            <Table.Root size="2" variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>{t("heading")}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>{t("filters.domain")}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>{t("filters.county")}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>{t("filters.year")}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>{t("callType")}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>{t("amount")}</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {opportunities.map((opportunity) => {
                  const formattedAmount = formatCurrency(opportunity.amount_awarded, opportunity.currency);
                  return (
                    <Table.Row key={opportunity.id}>
                      <Table.Cell>
                        <Flex direction="column" gap="1">
                          <Text weight="medium">{opportunity.title}</Text>
                          {opportunity.lead_institution && (
                            <Text size="2" color="gray">
                              {t("lead")}: {opportunity.lead_institution}
                            </Text>
                          )}
                          {opportunity.summary && (
                            <Text size="2" color="gray">
                              {opportunity.summary}
                            </Text>
                          )}
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>{opportunity.domain ?? "—"}</Table.Cell>
                      <Table.Cell>{opportunity.county ?? "—"}</Table.Cell>
                      <Table.Cell>{opportunity.call_year ?? "—"}</Table.Cell>
                      <Table.Cell>{opportunity.call_type ?? "—"}</Table.Cell>
                      <Table.Cell>{formattedAmount ?? "—"}</Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          )}
        </Flex>
      </Card>
    </Flex>
  );
}
