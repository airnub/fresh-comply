import type { Connection } from "@temporalio/client";
import type { SearchAttributes } from "@temporalio/common";
import type { ServiceError } from "@grpc/grpc-js";
import { status as grpcStatus } from "@grpc/grpc-js";
import * as proto from "@temporalio/proto";

export const SEARCH_ATTRIBUTES = {
  tenantId: "TenantId",
  runId: "RunId",
  subjectOrg: "SubjectOrg",
  stepKey: "StepKey",
  environment: "Environment"
} as const;

export type SearchAttributeValues = {
  tenantId: string;
  runId: string;
  subjectOrg: string;
  stepKey: string;
  environment?: string;
};

export function buildSearchAttributes(values: SearchAttributeValues): SearchAttributes {
  const attrs: SearchAttributes = {
    [SEARCH_ATTRIBUTES.tenantId]: [values.tenantId],
    [SEARCH_ATTRIBUTES.runId]: [values.runId],
    [SEARCH_ATTRIBUTES.subjectOrg]: [values.subjectOrg],
    [SEARCH_ATTRIBUTES.stepKey]: [values.stepKey]
  };
  if (values.environment) {
    attrs[SEARCH_ATTRIBUTES.environment] = [values.environment];
  }
  return attrs;
}

export async function ensureSearchAttributes(
  connection: Connection,
  namespace: string,
  keywordType: number =
    proto.temporal.api.enums.v1.IndexedValueType.INDEXED_VALUE_TYPE_KEYWORD
) {
  const searchAttributes = Object.fromEntries(
    Object.values(SEARCH_ATTRIBUTES).map((name) => [name, keywordType])
  );

  try {
    await connection.operatorService.addSearchAttributes({
      namespace,
      searchAttributes
    });
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      return;
    }
    throw error;
  }
}

function isAlreadyExistsError(error: unknown): error is ServiceError {
  if (!error || typeof error !== "object") {
    return false;
  }

  const serviceError = error as Partial<ServiceError>;

  return serviceError.code === grpcStatus.ALREADY_EXISTS;
}
