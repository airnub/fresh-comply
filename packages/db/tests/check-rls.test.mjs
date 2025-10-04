import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { checkRlsSchema } from "../check-rls.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, "../schema.sql");
const baseSchema = await readFile(schemaPath, "utf8");

test("rejects policies that allow org_id IS NULL", () => {
  const schema = `${baseSchema}\ncreate policy "Test Null Tenant" on organisations\n  for select\n  using (org_id is null);\n`;

  try {
    checkRlsSchema(schema);
    assert.fail("Expected org_id guard to throw");
  } catch (error) {
    assert.match(error.message, /org_id/i);
    assert.match(error.message, /organisations\.Test Null Tenant/);
  }
});

test("rejects policies that allow org_id IS NULL on update", () => {
  const schema = `${baseSchema}\ncreate policy "Test Null Org" on organisations\n  for update\n  using (org_id is null);\n`;

  try {
    checkRlsSchema(schema);
    assert.fail("Expected org_id guard to throw");
  } catch (error) {
    assert.match(error.message, /org_id/i);
    assert.match(error.message, /organisations\.Test Null Org/);
  }
});
