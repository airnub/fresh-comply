import path from "node:path";
import { loadDSL } from "@airnub/engine/dsl";
import { materializeSteps } from "@airnub/engine/engine";
import { verifyRule } from "@airnub/freshness/verify";
import { SOURCES } from "@airnub/freshness/sources";
import { renderBoardMinutes } from "@airnub/doc-templates/index";

const DSL_PATH = path.resolve(
  process.cwd(),
  "..",
  "..",
  "packages",
  "workflows",
  "ie-nonprofit-clg-charity.yaml"
);

export type DemoStep = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "waiting" | "blocked" | "done";
  dueDate?: string;
  assignee?: string;
  verifyRules?: Awaited<ReturnType<typeof verifyRule>>[];
};

export type DemoRun = {
  id: string;
  title: string;
  engager: string;
  client: string;
  timeline: DemoStep[];
  audit: { id: string; actor: string; action: string; timestamp: string; onBehalfOf?: string }[];
  documents: { title: string; checksum: string; content: string; pdfBase64: string }[];
};

let cachedRun: DemoRun | null = null;

export async function getDemoRun(): Promise<DemoRun> {
  if (cachedRun) return cachedRun;
  const dsl = loadDSL(DSL_PATH);
  const steps = materializeSteps(dsl).map((step, index) => ({
    id: step.id,
    title: step.title,
    status: index === 0 ? "in_progress" : index === 1 ? "waiting" : "todo",
    dueDate: new Date(Date.now() + index * 1000 * 60 * 60 * 24 * 7).toISOString(),
    assignee: index % 2 === 0 ? "Aoife Kelly" : "Brian Moore",
    verifyRules: step.verify?.map((rule) => ({
      id: rule.id,
      name: rule.id.replace(/_/g, " "),
      sources: Object.values(SOURCES)
        .slice(0, 2)
        .map((source) => source.url),
      lastVerifiedAt: new Date(Date.now() - (index + 1) * 1000 * 60 * 60 * 24).toISOString()
    }))
  }));

  const documents = [renderBoardMinutes({
    orgName: "Company X (Client)",
    date: new Date().toISOString().split("T")[0],
    time: "09:30",
    location: "FreshComply HQ"
  })];

  const audit = [
    {
      id: "audit-1",
      actor: "Aoife Kelly",
      action: "Started workflow setup-nonprofit-ie-charity",
      timestamp: new Date().toISOString(),
      onBehalfOf: "Company X"
    }
  ];

  cachedRun = {
    id: "demo-run",
    title: "IE CLG Charity Setup",
    engager: "Company A",
    client: "Company X",
    timeline: steps as DemoStep[],
    audit,
    documents: documents.map((doc) => ({
      title: doc.filename,
      checksum: doc.checksum,
      content: doc.content,
      pdfBase64: doc.pdfBase64
    }))
  };

  return cachedRun;
}

export async function reverifyRule(ruleId: string) {
  if (!cachedRun) await getDemoRun();
  if (!cachedRun) return null;
  const step = cachedRun.timeline.find((item) => item.verifyRules?.some((rule) => rule.id === ruleId));
  if (!step || !step.verifyRules) return null;
  step.verifyRules = await Promise.all(
    step.verifyRules.map(async (rule) => (rule.id === ruleId ? await verifyRule(rule) : rule))
  );
  return step.verifyRules.find((rule) => rule.id === ruleId);
}

export function getDemoDocument() {
  if (!cachedRun) return null;
  return cachedRun.documents[0];
}
