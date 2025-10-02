import React from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Card, Flex, Text } from "@radix-ui/themes";

export type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  timestamp: string;
  onBehalfOf?: string;
};

export function AuditLog({ entries }: { entries: AuditEntry[] }) {
  const t = useTranslations("audit");
  const format = useFormatter();
  return (
    <Card variant="surface" size="2" role="region" aria-live="polite">
      <Flex direction="column" gap="3">
        <Text as="h3" id="audit-log-heading" weight="medium" size="3">
          {t("title")}
        </Text>
        <Flex asChild direction="column" gap="3">
          <ul aria-labelledby="audit-log-heading">
            {entries.map((entry) => (
              <Flex asChild key={entry.id} direction="column" gap="1">
                <li>
                  <Flex justify="between" align="center" gap="3" wrap="wrap">
                    <Text as="span" size="2" weight="medium">
                      {entry.actor}
                    </Text>
                    <Text as="span" size="2" color="gray">
                      {format.dateTime(new Date(entry.timestamp), { dateStyle: "medium", timeStyle: "short" })}
                    </Text>
                  </Flex>
                  <Text as="p" size="2" color="gray">
                    {entry.action}
                  </Text>
                  {entry.onBehalfOf && (
                    <Text as="p" size="1" color="gray">
                      {t("onBehalfOf", { organisation: entry.onBehalfOf })}
                    </Text>
                  )}
                </li>
              </Flex>
            ))}
          </ul>
        </Flex>
      </Flex>
    </Card>
  );
}
