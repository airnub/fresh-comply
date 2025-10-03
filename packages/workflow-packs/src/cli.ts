#!/usr/bin/env node
import { resolve } from "node:path";
import { exit } from "node:process";
import {
  computePackChecksum,
  loadPackFromDirectory,
  loadWorkflowFromFile,
  mergeWorkflowWithPack,
  verifyPackSignature,
  WorkflowPackError
} from "./index";

function printUsage() {
  console.log(`Usage: fc-pack <command> [options]

Commands:
  validate <packDir> --workflow <path>   Validate pack against workflow
  impact <packDir> --workflow <path>     Show impact map after merge
  checksum <packDir>                     Print SHA-256 checksum for signing
`);
}

function parseArgs(argv: string[]): { command?: string; packDir?: string; workflowPath?: string } {
  const [command, packDir, ...rest] = argv;
  if (!command) {
    return {};
  }
  let workflowPath: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--workflow") {
      workflowPath = rest[i + 1];
      i++;
    }
  }
  return { command, packDir, workflowPath };
}

async function run() {
  const { command, packDir, workflowPath } = parseArgs(process.argv.slice(2));

  if (!command) {
    printUsage();
    exit(1);
  }

  try {
    switch (command) {
      case "validate": {
        if (!packDir || !workflowPath) {
          throw new WorkflowPackError("validate requires <packDir> and --workflow <path>");
        }
        const pack = loadPackFromDirectory(resolve(packDir));
        const workflow = loadWorkflowFromFile(resolve(workflowPath));
        const merge = mergeWorkflowWithPack(workflow, pack);
        const signatureOk = verifyPackSignature(pack);
        console.log(`Pack ${pack.manifest.name}@${pack.manifest.version} is valid.`);
        console.log(`Impact: +${merge.impactMap.addedSteps.length} / -${merge.impactMap.removedSteps.length} / ~${merge.impactMap.changedSteps.length}`);
        if (merge.warnings.length > 0) {
          console.log("Warnings:");
          for (const warning of merge.warnings) {
            console.log(`  - ${warning}`);
          }
        }
        console.log(`Signature: ${signatureOk ? "verified" : "missing"}`);
        break;
      }
      case "impact": {
        if (!packDir || !workflowPath) {
          throw new WorkflowPackError("impact requires <packDir> and --workflow <path>");
        }
        const pack = loadPackFromDirectory(resolve(packDir));
        const workflow = loadWorkflowFromFile(resolve(workflowPath));
        const merge = mergeWorkflowWithPack(workflow, pack);
        console.log(JSON.stringify(merge.impactMap, null, 2));
        if (merge.warnings.length > 0) {
          console.error("Warnings:");
          for (const warning of merge.warnings) {
            console.error(`  - ${warning}`);
          }
        }
        break;
      }
      case "checksum": {
        if (!packDir) {
          throw new WorkflowPackError("checksum requires <packDir>");
        }
        const checksum = computePackChecksum(resolve(packDir));
        console.log(checksum);
        break;
      }
      default:
        printUsage();
        exit(1);
    }
  } catch (error) {
    if (error instanceof WorkflowPackError) {
      console.error(error.message);
      exit(1);
    }
    console.error(error);
    exit(1);
  }
}

run();
