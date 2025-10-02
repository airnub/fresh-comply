import Link from "next/link";
import { getDemoRun } from "../lib/demo-data";

export default async function Home() {
  const run = await getDemoRun();

  return (
    <div className="mt-6 space-y-4">
      <section className="rounded border bg-white p-6 shadow">
        <h2 className="text-2xl font-semibold">Welcome to FreshComply</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Explore the workflow engine, freshness checks, document generation, and audit visibility in one place.
        </p>
        <div className="mt-4 inline-flex gap-4">
          <Link href={`/(workflow)/run/${run.id}`} className="rounded bg-blue-600 px-3 py-2 text-white">
            View timeline
          </Link>
          <Link href={`/(workflow)/board/${run.id}`} className="rounded border px-3 py-2">
            Open task board
          </Link>
        </div>
      </section>
      <section className="rounded border bg-white p-6 shadow">
        <h3 className="font-semibold">Demo workflow</h3>
        <p className="text-sm text-muted-foreground">{run.title}</p>
        <ul className="mt-4 space-y-2 text-sm">
          {run.timeline.slice(0, 3).map((step) => (
            <li key={step.id} className="flex items-center justify-between">
              <span>{step.title}</span>
              <span className="text-muted-foreground">Status: {step.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
