import React from "react";

export type Task = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "waiting" | "blocked" | "done";
  assignee?: string;
  dueDate?: string;
};

const STATUSES: Task["status"][] = ["todo", "in_progress", "waiting", "blocked", "done"];

export function TaskBoard({ tasks }: { tasks: Task[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-5">
      {STATUSES.map((status) => (
        <div key={status} className="rounded border bg-white shadow-sm">
          <header className="border-b bg-gray-50 px-3 py-2 text-sm font-semibold capitalize">{status.replace("_", " ")}</header>
          <ul className="space-y-2 p-3">
            {tasks
              .filter((task) => task.status === status)
              .map((task) => (
                <li key={task.id} className="rounded border bg-white p-2 shadow">
                  <p className="font-medium">{task.title}</p>
                  {task.assignee && <p className="text-sm text-muted-foreground">{task.assignee}</p>}
                  {task.dueDate && <p className="text-xs text-muted-foreground">Due {new Date(task.dueDate).toLocaleDateString()}</p>}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
