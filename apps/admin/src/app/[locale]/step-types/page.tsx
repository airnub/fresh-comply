import { Card, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { getTranslations } from "next-intl/server";
import { DataTable } from "@/components/DataTable";
import { StepTypeActions } from "./step-type-actions";
import { getSupabaseUser } from "@/lib/auth/supabase-ssr";
import { requireRole, type AdminRole } from "@/lib/rbac";
import {
  loadOverlaySnapshots,
  loadSecretBindings,
  loadStepTypeRegistry,
  loadStepTypeVersions,
  loadTenantInstalls,
} from "./loaders";

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

  const [registry, versions, installs, secrets, overlays] = await Promise.all([
    loadStepTypeRegistry(),
    loadStepTypeVersions(),
    loadTenantInstalls(),
    loadSecretBindings(),
    loadOverlaySnapshots(),
  ]);

  return (
    <Flex direction="column" gap="5">
      <section>
        <Heading size="8">{t("heading")}</Heading>
        <Text size="3" color="gray">
          {t("subheading")}
        </Text>
      </section>

      <StepTypeActions
        registry={registry}
        versions={versions}
        tenantInstalls={installs}
        secretBindings={secrets}
      />

      <Grid columns={{ initial: "1", md: "2" }} gap="4">
        {registry.map((item) => (
          <Card key={item.id} variant="surface">
            <Flex direction="column" gap="3">
              <Heading size="4">{item.title}</Heading>
              {item.summary ? (
                <Text size="2" color="gray">
                  {item.summary}
                </Text>
              ) : null}
              <Flex gap="3" align="center" wrap="wrap">
                <Text size="2" weight="medium">
                  {t("registry.slug", { slug: item.slug })}
                </Text>
                <Text size="2" color="gray">
                  {t("registry.category", { category: item.category })}
                </Text>
                <Text size="2" color="gray">
                  {t("registry.latest", { version: item.latest_version })}
                </Text>
                <Text size="2" color="gray">
                  {t("registry.published", { count: item.published_versions })}
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
            data={versions.map((entry) => ({
              id: entry.id,
              stepType: entry.step_type_slug,
              version: entry.version,
              status: entry.status,
              schemaSlug: entry.schema_slug ?? "—",
              publishedAt: entry.published_at ?? "—",
            }))}
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
              data={installs.map((entry) => ({
                id: entry.id,
                tenant: entry.tenant_name,
                stepTypeVersion: entry.step_type_version,
                status: entry.status,
                installedAt: entry.installed_at ?? "—",
              }))}
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
              data={secrets.map((entry) => ({
                id: entry.id,
                tenant: entry.tenant_name,
                alias: entry.alias,
                provider: entry.provider,
                externalId: entry.external_id,
              }))}
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
            data={overlays.map((entry) => ({
              id: entry.id,
              workflow: entry.workflow_slug,
              tenant: entry.tenant_name,
              overlays: entry.overlay_count,
              createdAt: entry.created_at,
            }))}
          />
        </Flex>
      </Card>
    </Flex>
  );
}
