import React from "react";
import { Button, Card, Flex, Link, Text } from "@radix-ui/themes";
import { ExternalLinkIcon } from "@radix-ui/react-icons";

export type EvidenceItem = {
  id: string;
  title: string;
  sources: { label: string; url: string }[];
  lastVerifiedAt?: string;
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
          </Flex>
        </Card>
      ))}
    </Flex>
  );
}
