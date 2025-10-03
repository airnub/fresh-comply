import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import type { WorkflowDefinition, ValidationResult } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, "../schemas/workflow-definition.schema.json");
const workflowSchema = JSON.parse(readFileSync(schemaPath, "utf-8"));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile<WorkflowDefinition>(workflowSchema);

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors) {
    return [];
  }

  return errors.map((error) => {
    const instancePath = error.instancePath || "<root>";
    const message = error.message ?? "is invalid";
    return `${instancePath} ${message}`.trim();
  });
}

export function validateWorkflow(workflow: WorkflowDefinition): ValidationResult {
  const isValid = validate(workflow);
  return {
    valid: !!isValid,
    errors: formatErrors(validate.errors)
  };
}

export { workflowSchema };
export * from "./types";
