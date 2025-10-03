import path from "node:path";
import { loadDSL } from "@airnub/engine/dsl";
import { materializeSteps } from "@airnub/engine/engine";
import type { StepExecution } from "@airnub/engine/types";
import type { Rule } from "@airnub/freshness/verify";
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

export type DemoOrchestration = {
  status: "idle" | "running" | "awaiting_signal" | "completed" | "failed";
  workflowId?: string;
  resultSummary?: string;
};

export type DemoStep = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "waiting" | "blocked" | "done";
  dueDate?: string;
  assignee?: string;
  verifyRules?: Rule[];
  freshness?: {
    status: Rule["status"];
    verifiedAt?: string;
  };
  execution?: StepExecution;
  orchestration?: DemoOrchestration;
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
  const orchestrationStates: DemoOrchestration["status"][] = [
    "completed",
    "running",
    "awaiting_signal",
    "awaiting_signal",
    "idle",
    "idle",
    "idle"
  ];

  const steps = await Promise.all(
    materializeSteps(dsl).map(async (step, index) => {
      const execution = step.execution as StepExecution | undefined;
      const orchestration =
        execution?.mode === "temporal" || execution?.mode === "external:websocket"
          ? {
              status: orchestrationStates[index] ?? "idle",
              workflowId: `demo-${step.id}`,
              resultSummary:
                index === 0
                  ? "Name available — reserved for 28 days"
                  : index === 1
                    ? "Rendering board minutes and filings"
                    : index === 3
                      ? "Awaiting advisor confirmation"
                      : execution?.mode === "external:websocket"
                        ? "Listening for tenant stream events"
                        : undefined
            }
          : execution?.mode === "external:webhook"
            ? {
                status: "idle" as const,
                resultSummary: "Invoke tenant webhook with signed payload"
              }
            : undefined;

    const status: DemoStep["status"] =
      index === 0
        ? "done"
        : index === 1
          ? "in_progress"
          : index === 2
            ? "waiting"
          : index === 3
            ? "waiting"
            : "todo";

      const verifyRules = step.verify
        ? await Promise.all(
            step.verify.map(async (rule) =>
              verifyRule({
                id: rule.id,
                name: rule.id.replace(/_/g, " "),
                sources: getSourcesForStep(step.id)
              })
            )
          )
        : undefined;

      return {
        id: step.id,
        title: step.title,
        status,
        dueDate: new Date(Date.now() + index * 1000 * 60 * 60 * 24 * 7).toISOString(),
        assignee: index % 2 === 0 ? "Aoife Kelly" : "Brian Moore",
        verifyRules,
        freshness: summariseFreshness(verifyRules),
        execution,
        orchestration
      } satisfies DemoStep;
    })
  );

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
  step.freshness = summariseFreshness(step.verifyRules);
  return step.verifyRules.find((rule) => rule.id === ruleId);
}

export function getDemoDocument() {
  if (!cachedRun) return null;
  return cachedRun.documents[0];
}

type SourceKey = keyof typeof SOURCES;

function getSourcesForStep(stepId: string): SourceKey[] {
  switch (stepId) {
    case "cro-name-check":
      return ["cro_open_services"];
    case "cro-a1-pack":
      return ["cro_open_services", "charities_ckan"];
    case "revenue-tr2":
    case "revenue-etax-clearance":
      return ["revenue_charities"];
    default:
      return ["charities_ckan"];
  }
}

function summariseFreshness(rules?: Rule[]) {
  if (!rules?.length) return undefined;
  const timestamps = rules
    .map((rule) => rule.lastVerifiedAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => (a > b ? -1 : 1));
  const status = rules.every((rule) => rule.status === "verified") ? "verified" : "stale";
  return { status, verifiedAt: timestamps[0] };
}
