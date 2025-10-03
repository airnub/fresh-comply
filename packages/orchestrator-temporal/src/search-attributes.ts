import type { Connection } from "@temporalio/client";
import type { SearchAttributes } from "@temporalio/common";
import * as proto from "@temporalio/proto";

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

export function buildSearchAttributes(values: SearchAttributeValues): SearchAttributes {
  const attrs: SearchAttributes = {
    [SEARCH_ATTRIBUTES.runId]: [values.runId],
    [SEARCH_ATTRIBUTES.subjectOrg]: [values.subjectOrg],
    [SEARCH_ATTRIBUTES.stepKey]: [values.stepKey]
  };
  if (values.environment) {
    attrs[SEARCH_ATTRIBUTES.environment] = [values.environment];
  }
  return attrs;
}

export async function ensureSearchAttributes(connection: Connection, namespace: string) {
  const keywordType =
    proto.temporal.api.enums.v1.IndexedValueType.INDEXED_VALUE_TYPE_KEYWORD;
  const searchAttributes = Object.fromEntries(
    Object.values(SEARCH_ATTRIBUTES).map((name) => [name, keywordType])
  );

  await connection.operatorService.addSearchAttributes({
    namespace,
    searchAttributes
  });
}
