import { Card, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { getTranslations } from "next-intl/server";
import { DataTable } from "../../../components/DataTable";
import { getSupabaseUser } from "../../../lib/auth/supabase-ssr";
import { requireRole, type AdminRole } from "../../../lib/rbac";

const registry = [
  {
    id: "stp-temporal-webhook",
    slug: "temporal.webhook",
    title: "Temporal Webhook Bridge",
    category: "automation",
    latestVersion: "1.4.0",
    summary: "Bridges tenant webhooks with managed Temporal workflows.",
    publishedVersions: 3,
  },
  {
    id: "stp-manual-review",
    slug: "manual.review",
    title: "Manual Review with Evidence",
    category: "governance",
    latestVersion: "2.1.0",
    summary: "Collect reviewer notes and ensure dual-control sign-off.",
    publishedVersions: 4,
  },
];

const versionLedger = [
  {
    id: "stv-1",
    stepType: "temporal.webhook",
    version: "1.4.0",
    status: "published",
    publishedAt: "2025-10-01",
    schemaSlug: "schemas/webhook-input@1",
  },
  {
    id: "stv-2",
    stepType: "manual.review",
    version: "2.1.0",
    status: "published",
    publishedAt: "2025-09-14",
    schemaSlug: "schemas/review-checklist@2",
  },
  {
    id: "stv-3",
    stepType: "manual.review",
    version: "2.2.0",
    status: "draft",
    publishedAt: "—",
    schemaSlug: "schemas/review-checklist@3",
  },
];

const tenantInstalls = [
  {
    id: "install-1",
    tenant: "Company X",
    orgSlug: "company-x",
    stepTypeVersion: "temporal.webhook@1.4.0",
    status: "enabled",
    installedAt: "2025-10-05",
  },
  {
    id: "install-2",
    tenant: "Acme Foundation",
    orgSlug: "acme-foundation",
    stepTypeVersion: "manual.review@2.1.0",
    status: "enabled",
    installedAt: "2025-09-18",
  },
];

const secretBindings = [
  {
    id: "secret-1",
    tenant: "Company X",
    alias: "secrets.crm.apiToken",
    provider: "HashiCorp Vault",
    externalId: "kv/data/company-x/crm",
  },
  {
    id: "secret-2",
    tenant: "Acme Foundation",
    alias: "secrets.temporal.taskQueueKey",
    provider: "AWS Secrets Manager",
    externalId: "arn:aws:secretsmanager:eu-west-1:123456789:key",
  },
];

const overlayActivity = [
  {
    id: "snapshot-1",
    workflow: "setup-nonprofit-ie-charity",
    tenant: "Company X",
    overlays: 2,
    createdAt: "2025-10-06",
  },
  {
    id: "snapshot-2",
    workflow: "setup-nonprofit-ie-charity",
    tenant: "Acme Foundation",
    overlays: 1,
    createdAt: "2025-09-22",
  },
];

export default async function StepTypesPage() {
  const t = await getTranslations({ namespace: "stepTypes" });

  try {
    const user = await getSupabaseUser();
    const role = (user?.app_metadata?.admin_role ?? user?.user_metadata?.admin_role) as AdminRole | undefined;
    if (role) {
      requireRole({ role }, ["platform_admin", "support_agent"]);
    }
  } catch (error) {
    console.warn("Supabase unavailable for step types RBAC", error);
  }

  return (
    <Flex direction="column" gap="5">
      <section>
        <Heading size="8">{t("heading")}</Heading>
        <Text size="3" color="gray">{t("subheading")}</Text>
      </section>

      <Grid columns={{ initial: "1", md: "2" }} gap="4">
        {registry.map((item) => (
          <Card key={item.id} variant="surface">
            <Flex direction="column" gap="3">
              <Heading size="4">{item.title}</Heading>
              <Text size="2" color="gray">
                {item.summary}
              </Text>
              <Flex gap="3" align="center" wrap="wrap">
                <Text size="2" weight="medium">
                  {t("registry.slug", { slug: item.slug })}
                </Text>
                <Text size="2" color="gray">
                  {t("registry.category", { category: item.category })}
                </Text>
                <Text size="2" color="gray">
                  {t("registry.latest", { version: item.latestVersion })}
                </Text>
                <Text size="2" color="gray">
                  {t("registry.published", { count: item.publishedVersions })}
                </Text>
              </Flex>
            </Flex>
          </Card>
        ))}
      </Grid>

      <Card variant="surface">
        <Flex direction="column" gap="4">
          <header>
            <Heading size="5">{t("versions.title")}</Heading>
            <Text size="2" color="gray">
              {t("versions.subtitle")}
            </Text>
          </header>
          <DataTable
            caption={t("versions.caption")}
            emptyState={t("versions.empty")}
            columns={[
              { key: "stepType", header: t("versions.columns.stepType") },
              { key: "version", header: t("versions.columns.version") },
              {
                key: "status",
                header: t("versions.columns.status"),
                render: (value) => (
                  <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
                    {t(`versions.status.${String(value)}`)}
                  </span>
                ),
              },
              { key: "schemaSlug", header: t("versions.columns.schema") },
              { key: "publishedAt", header: t("versions.columns.publishedAt") },
            ]}
            data={versionLedger}
          />
        </Flex>
      </Card>

      <Grid columns={{ initial: "1", md: "2" }} gap="4">
        <Card variant="surface">
          <Flex direction="column" gap="4">
            <header>
              <Heading size="5">{t("installs.title")}</Heading>
              <Text size="2" color="gray">{t("installs.subtitle")}</Text>
            </header>
            <DataTable
              caption={t("installs.caption")}
              emptyState={t("installs.empty")}
              columns={[
                { key: "tenant", header: t("installs.columns.tenant") },
                { key: "stepTypeVersion", header: t("installs.columns.version") },
                {
                  key: "status",
                  header: t("installs.columns.status"),
                  render: (value) => (
                    <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                      {t(`installs.status.${String(value)}`)}
                    </span>
                  ),
                },
                { key: "installedAt", header: t("installs.columns.installedAt") },
              ]}
              data={tenantInstalls}
            />
          </Flex>
        </Card>

        <Card variant="surface">
          <Flex direction="column" gap="4">
            <header>
              <Heading size="5">{t("secrets.title")}</Heading>
              <Text size="2" color="gray">{t("secrets.subtitle")}</Text>
            </header>
            <DataTable
              caption={t("secrets.caption")}
              emptyState={t("secrets.empty")}
              columns={[
                { key: "tenant", header: t("secrets.columns.tenant") },
                { key: "alias", header: t("secrets.columns.alias") },
                { key: "provider", header: t("secrets.columns.provider") },
                { key: "externalId", header: t("secrets.columns.externalId") },
              ]}
              data={secretBindings}
            />
          </Flex>
        </Card>
      </Grid>

      <Card variant="surface">
        <Flex direction="column" gap="4">
          <header>
            <Heading size="5">{t("overlays.title")}</Heading>
            <Text size="2" color="gray">{t("overlays.subtitle")}</Text>
          </header>
          <DataTable
            caption={t("overlays.caption")}
            emptyState={t("overlays.empty")}
            columns={[
              { key: "workflow", header: t("overlays.columns.workflow") },
              { key: "tenant", header: t("overlays.columns.tenant") },
              { key: "overlays", header: t("overlays.columns.count") },
              { key: "createdAt", header: t("overlays.columns.createdAt") },
            ]}
            data={overlayActivity}
          />
        </Flex>
      </Card>
    </Flex>
  );
}
