import React from "react";
import { Badge, Card, Flex, Grid, Text, type BadgeProps } from "@radix-ui/themes";

type ExecutionMode = "manual" | "temporal" | "external:webhook" | "external:websocket";

function formatExecutionLabel(mode: ExecutionMode, orchestrationStatus?: string) {
  switch (mode) {
    case "temporal":
      return orchestrationStatus ? `Temporal · ${orchestrationStatus.replace(/_/g, " ")}` : "Temporal";
    case "external:webhook":
      return "External · Webhook";
    case "external:websocket":
      return orchestrationStatus
        ? `External · WebSocket · ${orchestrationStatus.replace(/_/g, " ")}`
        : "External · WebSocket";
    default:
      return "Manual";
  }
}

export type Task = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "waiting" | "blocked" | "done";
  assignee?: string;
  dueDate?: string;
  executionMode?: ExecutionMode;
  orchestrationStatus?: string;
};

const STATUSES: Task["status"][] = ["todo", "in_progress", "waiting", "blocked", "done"];

const DEFAULT_LABELS: Record<Task["status"], string> = {
  todo: "To do",
  in_progress: "In progress",
  waiting: "Waiting",
  blocked: "Blocked",
  done: "Done"
};

const STATUS_BADGES: Record<Task["status"], BadgeProps["color"]> = {
  todo: "gray",
  in_progress: "indigo",
  waiting: "amber",
  blocked: "red",
  done: "green"
};

type TaskBoardProps = {
  tasks: Task[];
  statusLabels?: Partial<Record<Task["status"], string>>;
  formatDueDate?: (isoDate: string) => string;
};

export function TaskBoard({ tasks, statusLabels, formatDueDate }: TaskBoardProps) {
  return (
    <Grid columns={{ initial: "1", md: "5" }} gap="3">
      {STATUSES.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status);
        return (
          <Card key={status} variant="surface" size="2">
            <Flex direction="column" gap="3">
              <Flex align="center" justify="between">
                <Text as="span" weight="medium">
                  {statusLabels?.[status] ?? DEFAULT_LABELS[status]}
                </Text>
                <Badge variant="soft" radius="full" color={STATUS_BADGES[status]}>
                  {columnTasks.length}
                </Badge>
              </Flex>
              <Flex asChild direction="column" gap="2">
                <ul>
                  {columnTasks.map((task) => (
                    <Card asChild key={task.id} variant="classic" size="1">
                      <li>
                        <Flex direction="column" gap="1">
                          <Text as="p" weight="medium" size="2">
                            {task.title}
                          </Text>
                          <Flex gap="2" wrap="wrap">
                            {task.assignee && (
                              <Text as="span" size="2" color="gray">
                                {task.assignee}
                              </Text>
                            )}
                            {task.executionMode && (
                              <Badge
                                color={
                                  task.executionMode === "temporal"
                                    ? "blue"
                                    : task.executionMode === "external:webhook"
                                      ? "amber"
                                      : task.executionMode === "external:websocket"
                                        ? "teal"
                                        : "gray"
                                }
                                radius="full"
                                variant="soft"
                              >
                                {formatExecutionLabel(task.executionMode, task.orchestrationStatus)}
                              </Badge>
                            )}
                          </Flex>
                          {task.dueDate && (
                            <Text as="span" size="1" color="gray">
                              {formatDueDate
                                ? formatDueDate(task.dueDate)
                                : `Due ${new Date(task.dueDate).toLocaleDateString()}`}
                            </Text>
                          )}
                        </Flex>
                      </li>
                    </Card>
                  ))}
                </ul>
              </Flex>
            </Flex>
          </Card>
        );
      })}
    </Grid>
  );
}
