import React from "react";

export type TimelineItem = {
  id: string;
  title: string;
  status: string;
  dueDate?: string;
  assignee?: string;
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="rounded border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-muted-foreground">Status: {item.status}</p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              {item.dueDate && <p>Due {new Date(item.dueDate).toLocaleDateString()}</p>}
              {item.assignee && <p>Assigned to {item.assignee}</p>}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
