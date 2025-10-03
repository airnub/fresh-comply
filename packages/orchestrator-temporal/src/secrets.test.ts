import { strict as assert } from "node:assert";
import test from "node:test";

import {
  clearSecretCache,
  resolveSecretAlias,
  SecretAliasResolutionError
} from "./secrets.js";

test("resolveSecretAlias reads tenant scoped variables", () => {
  clearSecretCache();
  process.env.FC_SECRET_TENANT_X__API_TOKEN = "super-secret";
  const value = resolveSecretAlias("tenant-x", "api.token");
  assert.equal(value, "super-secret");
});

test("resolveSecretAlias throws when alias missing", () => {
  clearSecretCache();
  delete process.env.FC_SECRET_TENANT_X__MISSING;
  assert.throws(() => resolveSecretAlias("tenant-x", "missing"), SecretAliasResolutionError);
});
