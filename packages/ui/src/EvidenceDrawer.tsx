import React from "react";
import { Badge, Button, Card, Flex, Link, Text, type BadgeProps } from "@radix-ui/themes";
import { ExternalLinkIcon } from "@radix-ui/react-icons";

export type EvidenceItem = {
  id: string;
  title: string;
  sources: { label: string; url: string }[];
  lastVerifiedAt?: string;
  annotation?: string;
  badge?: { label: string; color?: BadgeProps["color"]; variant?: BadgeProps["variant"] };
  metadata?: { label: string; value: string }[];
};

type EvidenceDrawerProps = {
  items: EvidenceItem[];
  onReverify?: (id: string) => Promise<void> | void;
  reverifyLabel?: string;
  formatTimestamp?: (isoDate?: string) => string;
};

export function EvidenceDrawer({ items, onReverify, reverifyLabel = "Re-verify", formatTimestamp }: EvidenceDrawerProps) {
  return (
    <Flex direction="column" gap="3">
      {items.map((item) => (
        <Card key={item.id} variant="surface" size="2">
          <Flex direction="column" gap="3">
            <Flex align="start" justify="between" gap="4" wrap="wrap">
              <Flex direction="column" gap="1">
                <Text as="p" weight="medium" size="3">
                  {item.title}
                </Text>
                <Text as="span" size="2" color="gray">
                  {formatTimestamp
                    ? formatTimestamp(item.lastVerifiedAt)
                    : `Verified on ${item.lastVerifiedAt ? new Date(item.lastVerifiedAt).toLocaleString() : "—"}`}
                </Text>
                {item.annotation ? (
                  <Text as="span" size="2" color="gray">
                    {item.annotation}
                  </Text>
                ) : null}
                {item.badge ? (
                  <Badge color={item.badge.color ?? "green"} radius="full" variant={item.badge.variant ?? "soft"}>
                    {item.badge.label}
                  </Badge>
                ) : null}
              </Flex>
              {onReverify && (
                <Button onClick={() => onReverify(item.id)} variant="soft">
                  {reverifyLabel}
                </Button>
              )}
            </Flex>
            <Flex asChild direction="column" gap="2">
              <ul>
                {item.sources.map((source) => (
                  <Text asChild key={source.url} size="2">
                    <li>
                      <Link href={source.url} target="_blank" rel="noreferrer" underline="always">
                        <Flex align="center" gap="1">
                          <span>{source.label}</span>
                          <ExternalLinkIcon aria-hidden />
                        </Flex>
                      </Link>
                    </li>
                  </Text>
                ))}
              </ul>
            </Flex>
            {item.metadata?.length ? (
              <Flex asChild direction="column" gap="1">
                <ul>
                  {item.metadata.map((meta) => (
                    <Text asChild key={`${item.id}-${meta.label}`} size="1" color="gray">
                      <li>
                        <strong>{meta.label}:</strong> {meta.value}
                      </li>
                    </Text>
                  ))}
                </ul>
              </Flex>
            ) : null}
          </Flex>
        </Card>
      ))}
    </Flex>
  );
}
