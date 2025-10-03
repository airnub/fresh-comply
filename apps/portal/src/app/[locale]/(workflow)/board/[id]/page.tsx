import { notFound } from "next/navigation";
import { TaskBoard } from "@airnub/ui";
import { getTranslations } from "next-intl/server";
import { Card, Flex, Heading, Text } from "@radix-ui/themes";
import { getDemoRun } from "../../../../../lib/demo-data";

export default async function TaskBoardPage({
  params
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const run = await getDemoRun();
  if (id !== run.id) {
    notFound();
  }

  const tBoard = await getTranslations({ locale, namespace: "board" });
  const tHome = await getTranslations({ locale, namespace: "home" });

  const statusLabels = {
    todo: tHome("statusLabel.todo"),
    in_progress: tHome("statusLabel.in_progress"),
    waiting: tHome("statusLabel.waiting"),
    blocked: tHome("statusLabel.blocked"),
    done: tHome("statusLabel.done")
  } as const;

  return (
    <Flex direction="column" gap="4">
      <Card asChild variant="surface" size="3">
        <section aria-labelledby="board-heading">
          <Flex direction="column" gap="3">
            <Heading id="board-heading" size="5">
              {tBoard("title")}
            </Heading>
            <Text size="2" color="gray">
              {tBoard("description")}
            </Text>
              <TaskBoard
                tasks={run.timeline.map((step) => ({
                  id: step.id,
                  title: step.title,
                  status: step.status,
                  assignee: step.assignee,
                  dueDate: step.dueDate,
                  executionMode: step.execution?.mode,
                  orchestrationStatus: step.orchestration?.status
                }))}
              statusLabels={statusLabels}
              formatDueDate={(isoDate) => tBoard("due", { date: new Date(isoDate) })}
            />
          </Flex>
        </section>
      </Card>
      <Card asChild variant="surface" size="3">
        <section aria-labelledby="board-deadlines-heading">
          <Flex direction="column" gap="3">
            <Heading id="board-deadlines-heading" size="4">
              {tBoard("deadlines")}
            </Heading>
            <Flex asChild direction="column" gap="2">
              <ul>
                {run.timeline.map((step) => (
                  <li key={step.id}>
                    <Flex justify="between" align="center">
                      <Text as="span" size="2" weight="medium">
                        {step.title}
                      </Text>
                      <Text as="span" size="2" color="gray">
                        {step.dueDate ? tBoard("due", { date: new Date(step.dueDate) }) : tBoard("noDueDate")}
                      </Text>
                    </Flex>
                  </li>
                ))}
              </ul>
            </Flex>
          </Flex>
        </section>
      </Card>
    </Flex>
  );
}
