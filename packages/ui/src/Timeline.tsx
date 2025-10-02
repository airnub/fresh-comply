import React from "react";
import { Badge, Card, Flex, Text, type BadgeProps } from "@radix-ui/themes";

const STATUS_COLORS: Record<string, BadgeProps["color"]> = {
  done: "green",
  blocked: "red",
  waiting: "amber",
  in_progress: "indigo",
  todo: "gray"
};

export type TimelineItem = {
  id: string;
  title: string;
  status: string;
  dueDate?: string;
  assignee?: string;
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <Flex asChild direction="column" gap="3">
      <ol>
        {items.map((item) => {
          const statusLabel = item.status.replace(/_/g, " ");
          const formattedStatus = statusLabel.replace(/\b\w/g, (char) => char.toUpperCase());
          const badgeColor = STATUS_COLORS[item.status] ?? "blue";
          return (
            <Card asChild key={item.id} variant="surface">
              <li>
                <Flex direction="column" gap="3">
                  <Flex align="start" justify="between" wrap="wrap" gap="4">
                    <Flex direction="column" gap="2">
                      <Text as="p" size="3" weight="medium">
                        {item.title}
                      </Text>
                      <Badge color={badgeColor} radius="full" variant="soft">
                        {formattedStatus}
                      </Badge>
                    </Flex>
                    <Flex align="end" direction="column" gap="1">
                      {item.dueDate && (
                        <Text as="span" size="2" color="gray">
                          Due {new Date(item.dueDate).toLocaleDateString()}
                        </Text>
                      )}
                      {item.assignee && (
                        <Text as="span" size="2" color="gray">
                          Assigned to {item.assignee}
                        </Text>
                      )}
                    </Flex>
                  </Flex>
                </Flex>
              </li>
            </Card>
          );
        })}
      </ol>
    </Flex>
  );
}
