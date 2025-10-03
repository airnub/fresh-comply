import React from "react";
import { Badge, Card, Flex, Text, type BadgeProps } from "@radix-ui/themes";

const STATUS_COLORS: Record<string, BadgeProps["color"]> = {
  done: "green",
  blocked: "red",
  waiting: "amber",
  in_progress: "indigo",
  todo: "gray"
};

const ORCHESTRATION_STATUS_LABELS: Record<string, string> = {
  idle: "Not started",
  running: "Running",
  awaiting_signal: "Awaiting signal",
  completed: "Completed",
  failed: "Failed"
};

export type TimelineItem = {
  id: string;
  title: string;
  status: string;
  dueDate?: string;
  assignee?: string;
  executionMode?: "manual" | "temporal";
  orchestrationStatus?: keyof typeof ORCHESTRATION_STATUS_LABELS;
  orchestrationResult?: string;
  freshness?: {
    status: "verified" | "stale" | "pending";
    verifiedAt?: string;
    annotation?: string;
  };
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
                      <Flex gap="2" wrap="wrap">
                        <Badge color={badgeColor} radius="full" variant="soft">
                          {formattedStatus}
                        </Badge>
                        {item.executionMode && (
                          <Badge color={item.executionMode === "temporal" ? "blue" : "gray"} radius="full" variant="soft">
                            {item.executionMode === "temporal"
                              ? `Temporal · ${
                                  item.orchestrationStatus
                                    ? ORCHESTRATION_STATUS_LABELS[item.orchestrationStatus] ?? item.orchestrationStatus
                                    : "Not started"
                                }`
                              : "Manual"}
                          </Badge>
                        )}
                        {item.freshness && (
                          <Badge
                            color={
                              item.freshness.status === "verified"
                                ? "green"
                                : item.freshness.status === "pending"
                                  ? "amber"
                                  : "red"
                            }
                            radius="full"
                            variant="soft"
                          >
                            {item.freshness.annotation
                              ? item.freshness.annotation
                              : item.freshness.verifiedAt
                                ? `Freshness · ${new Date(item.freshness.verifiedAt).toLocaleDateString()}`
                                : `Freshness · ${item.freshness.status}`}
                          </Badge>
                        )}
                      </Flex>
                      {item.orchestrationResult && (
                        <Text as="span" size="2" color="gray">
                          {item.orchestrationResult}
                        </Text>
                      )}
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
