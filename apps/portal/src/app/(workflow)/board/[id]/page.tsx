import { notFound } from "next/navigation";
import { TaskBoard } from "@airnub/ui";
import { getDemoRun } from "../../../../../lib/demo-data";

export default async function TaskBoardPage({ params }: { params: { id: string } }) {
  const run = await getDemoRun();
  if (params.id !== run.id) {
    notFound();
  }

  return (
    <div className="mt-6 space-y-4">
      <section className="rounded border bg-white p-6 shadow">
        <h2 className="text-2xl font-semibold">Task board</h2>
        <p className="text-sm text-muted-foreground">
          Drag-and-drop coming soon. For now, review assignments across workflow statuses.
        </p>
        <div className="mt-4">
          <TaskBoard
            tasks={run.timeline.map((step) => ({
              id: step.id,
              title: step.title,
              status: step.status,
              assignee: step.assignee,
              dueDate: step.dueDate
            }))}
          />
        </div>
      </section>
      <section className="rounded border bg-white p-6 shadow">
        <h3 className="font-semibold">Upcoming deadlines</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {run.timeline.map((step) => (
            <li key={step.id} className="flex justify-between">
              <span>{step.title}</span>
              <span className="text-muted-foreground">
                {step.dueDate ? new Date(step.dueDate).toLocaleDateString() : "No due date"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
