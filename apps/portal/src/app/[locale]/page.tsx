import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getDemoRun } from "../../lib/demo-data";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const run = await getDemoRun();
  const tHome = await getTranslations({ locale, namespace: "home" });

  return (
    <div className="mt-6 space-y-4">
      <section className="rounded border border-subtle bg-surface p-6 shadow">
        <h2 className="text-2xl font-semibold text-foreground">{tHome("welcome")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{tHome("intro")}</p>
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          {tHome("timelinePlural", { count: run.timeline.length })}
        </p>
        <div className="mt-4 inline-flex gap-4">
          <Link
            href={`/${locale}/(workflow)/run/${run.id}`}
            className="rounded bg-accent px-3 py-2 text-sm font-medium text-on-accent"
          >
            {tHome("viewTimeline")}
          </Link>
          <Link
            href={`/${locale}/(workflow)/board/${run.id}`}
            className="rounded border border-subtle px-3 py-2 text-sm"
          >
            {tHome("openBoard")}
          </Link>
        </div>
      </section>
      <section className="rounded border border-subtle bg-surface p-6 shadow">
        <h3 className="font-semibold text-base">{tHome("demoWorkflow")}</h3>
        <p className="text-sm text-muted-foreground">{run.title}</p>
        <ul className="mt-4 space-y-2 text-sm">
          {run.timeline.slice(0, 3).map((step) => (
            <li key={step.id} className="flex items-center justify-between">
              <span>{step.title}</span>
              <span className="text-muted-foreground">
                {tHome("status", { status: tHome(`statusLabel.${step.status}` as any) })}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
