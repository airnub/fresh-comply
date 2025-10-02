import { notFound } from "next/navigation";
import { TaskBoard } from "@airnub/ui";
import { getTranslations } from "next-intl/server";
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
    <div className="mt-6 space-y-4">
      <section className="rounded border border-subtle bg-surface p-6 shadow">
        <h2 className="text-2xl font-semibold text-foreground">{tBoard("title")}</h2>
        <p className="text-sm text-muted-foreground">{tBoard("description")}</p>
        <div className="mt-4">
          <TaskBoard
            tasks={run.timeline.map((step) => ({
              id: step.id,
              title: step.title,
              status: step.status,
              assignee: step.assignee,
              dueDate: step.dueDate
            }))}
            statusLabels={statusLabels}
            formatDueDate={(isoDate) => tBoard("due", { date: new Date(isoDate) })}
          />
        </div>
      </section>
      <section className="rounded border border-subtle bg-surface p-6 shadow">
        <h3 className="text-base font-semibold text-foreground">{tBoard("deadlines")}</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {run.timeline.map((step) => (
            <li key={step.id} className="flex justify-between">
              <span>{step.title}</span>
              <span className="text-muted-foreground">
                {step.dueDate ? tBoard("due", { date: new Date(step.dueDate) }) : tBoard("noDueDate")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
