import { strict as assert } from "node:assert";
import test from "node:test";
import type { Connection } from "@temporalio/client";
import type { ServiceError } from "@grpc/grpc-js";
import { status as grpcStatus } from "@grpc/grpc-js";

import { ensureSearchAttributes } from "./search-attributes.js";

function createConnectionMock() {
  let callCount = 0;

  const connection = {
    operatorService: {
      async addSearchAttributes() {
        callCount += 1;
        if (callCount > 1) {
          const error = new Error("Search attributes already exist");
          (error as ServiceError).code = grpcStatus.ALREADY_EXISTS;
          throw error;
        }
      }
    }
  } satisfies Partial<Connection>;

  return { connection: connection as Connection, getCallCount: () => callCount };
}

test("ensureSearchAttributes swallows ALREADY_EXISTS errors", async () => {
  const { connection, getCallCount } = createConnectionMock();

  await ensureSearchAttributes(connection, "default", 2);
  await assert.doesNotReject(() => ensureSearchAttributes(connection, "default", 2));

  assert.equal(getCallCount(), 2);
});
