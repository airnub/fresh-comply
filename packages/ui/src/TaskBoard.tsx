import React from "react";

export type Task = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "waiting" | "blocked" | "done";
  assignee?: string;
  dueDate?: string;
};

const STATUSES: Task["status"][] = ["todo", "in_progress", "waiting", "blocked", "done"];

const DEFAULT_LABELS: Record<Task["status"], string> = {
  todo: "To do",
  in_progress: "In progress",
  waiting: "Waiting",
  blocked: "Blocked",
  done: "Done"
};

type TaskBoardProps = {
  tasks: Task[];
  statusLabels?: Partial<Record<Task["status"], string>>;
  formatDueDate?: (isoDate: string) => string;
};

export function TaskBoard({ tasks, statusLabels, formatDueDate }: TaskBoardProps) {
  return (
    <div className="grid-five">
      {STATUSES.map((status) => (
        <div key={status} className="rounded border border-subtle bg-surface shadow-sm">
          <header className="border-b border-subtle bg-surface-alt px-3 py-2 text-sm font-semibold">
            {statusLabels?.[status] ?? DEFAULT_LABELS[status]}
          </header>
          <ul className="space-y-2 p-3">
            {tasks
              .filter((task) => task.status === status)
              .map((task) => (
                <li key={task.id} className="rounded border border-subtle bg-surface-alt p-2 shadow-sm">
                  <p className="font-medium">{task.title}</p>
                  {task.assignee && <p className="text-sm text-muted-foreground">{task.assignee}</p>}
                  {task.dueDate && (
                    <p className="text-xs text-muted-foreground">
                      {formatDueDate ? formatDueDate(task.dueDate) : `Due ${new Date(task.dueDate).toLocaleDateString()}`}
                    </p>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
