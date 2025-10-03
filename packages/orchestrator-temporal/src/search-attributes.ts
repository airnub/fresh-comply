import type { WorkflowClient } from "@temporalio/client";

export const SEARCH_ATTRIBUTES = {
  runId: "RunId",
  subjectOrg: "SubjectOrg",
  stepKey: "StepKey",
  environment: "Environment"
} as const;

export type SearchAttributeValues = {
  runId: string;
  subjectOrg: string;
  stepKey: string;
  environment?: string;
};

export function buildSearchAttributes(values: SearchAttributeValues) {
  const attrs: Record<string, unknown> = {
    [SEARCH_ATTRIBUTES.runId]: values.runId,
    [SEARCH_ATTRIBUTES.subjectOrg]: values.subjectOrg,
    [SEARCH_ATTRIBUTES.stepKey]: values.stepKey
  };
  if (values.environment) {
    attrs[SEARCH_ATTRIBUTES.environment] = values.environment;
  }
  return attrs;
}

export async function ensureSearchAttributes(client: WorkflowClient) {
  const names = Object.values(SEARCH_ATTRIBUTES);
  await client.connection.operatorService.ensureSearchAttributes({
    searchAttributes: names.map((name) => ({
      name,
      type: 1 // Keyword
    }))
  });
}
