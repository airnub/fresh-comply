import Link from "next/link";
import { getTranslations } from "next-intl/server";

const SUBPROCESSORS_DOC_URL = "https://github.com/airnub/fresh-comply/blob/main/docs/LEGAL/SUBPROCESSORS.md";

export default async function SubprocessorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tLegal = await getTranslations({ locale, namespace: "legal" });

  return (
    <div className="mt-6 space-y-4">
      <section className="rounded border border-subtle bg-surface p-6 shadow">
        <h1 className="text-2xl font-semibold text-foreground">{tLegal("subprocessors.title")}</h1>
        <p className="text-sm text-muted-foreground">{tLegal("subprocessors.summary")}</p>
        <Link
          className="mt-4 inline-flex gap-2 rounded bg-accent px-3 py-2 text-sm font-medium text-on-accent"
          href={SUBPROCESSORS_DOC_URL}
          rel="noreferrer noopener"
          target="_blank"
        >
          {tLegal("subprocessors.cta")}
        </Link>
      </section>
    </div>
  );
}
