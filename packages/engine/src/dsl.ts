import fs from "node:fs";
import yaml from "js-yaml";
import { WorkflowDSL } from "./types.js";

export function loadDSL(path: string): WorkflowDSL {
  const raw = fs.readFileSync(path, "utf8");
  const dsl = (path.endsWith(".yaml") ? yaml.load(raw) : JSON.parse(raw)) as WorkflowDSL;
  if (!dsl || !dsl.id || !dsl.steps) throw new Error("Invalid DSL");
  return dsl;
}
