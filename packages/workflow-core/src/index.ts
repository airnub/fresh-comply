import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import type {
  StepTypeDefinition,
  WorkflowDefinition,
  ValidationResult
} from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workflowSchemaPath = resolve(
  __dirname,
  "../schemas/workflow-definition.schema.json"
);
const workflowSchema = JSON.parse(readFileSync(workflowSchemaPath, "utf-8"));
const stepTypeSchemaPath = resolve(__dirname, "./step-type.schema.json");
const stepTypeSchema = JSON.parse(readFileSync(stepTypeSchemaPath, "utf-8"));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateWorkflowSchema = ajv.compile<WorkflowDefinition>(workflowSchema);
const validateStepTypeSchema = ajv.compile<StepTypeDefinition>(stepTypeSchema);

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
  const isValid = validateWorkflowSchema(workflow);
  return {
    valid: !!isValid,
    errors: formatErrors(validateWorkflowSchema.errors)
  };
}

export { workflowSchema };
export function validateStepType(
  stepType: StepTypeDefinition
): ValidationResult {
  const isValid = validateStepTypeSchema(stepType);
  return {
    valid: !!isValid,
    errors: formatErrors(validateStepTypeSchema.errors)
  };
}

export { stepTypeSchema };
export * from "./types";
