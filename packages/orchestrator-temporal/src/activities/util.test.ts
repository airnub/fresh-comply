import { strict as assert } from "node:assert";
import test from "node:test";

import { createBusinessKey, persistStepProgress, type StepActivityContext } from "./util.js";

test("createBusinessKey composes a stable identifier", () => {
  const context: StepActivityContext = {
    tenantId: "tenant-xyz",
    orgId: "org-123",
    runId: "run-456",
    stepKey: "cro-name-check",
    partnerOrgId: "partner-789"
  };

  const key = createBusinessKey(context);

  assert.equal(key, "org-123:run-456:cro-name-check");
});

test("persistStepProgress returns enriched payload with timestamp", async () => {
  const payload = {
    tenantId: "tenant-xyz",
    orgId: "org-123",
    runId: "run-456",
    stepKey: "cro-name-check",
    partnerOrgId: "partner-789",
    status: "in_progress" as const,
    output: { available: true }
  };

  const result = await persistStepProgress(payload);

  assert.deepEqual(result.orgId, payload.orgId);
  assert.deepEqual(result.runId, payload.runId);
  assert.deepEqual(result.stepKey, payload.stepKey);
  assert.equal(result.status, payload.status);
  assert.deepEqual(result.output, payload.output);
  assert.ok(typeof result.updatedAt === "string" && !Number.isNaN(Date.parse(result.updatedAt)));
});
