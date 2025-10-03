#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = resolve(__dirname, "../src/cli.ts");

const child = spawn(process.execPath, ["--import", "tsx", cliPath, ...process.argv.slice(2)], {
  stdio: "inherit"
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
