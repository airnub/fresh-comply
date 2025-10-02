#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { renderBoardMinutes } from "@airnub/doc-templates";

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .command("render-minutes", "Render board minutes", (y) =>
      y.option("org", { type: "string", demandOption: true }).option("date", { type: "string", default: new Date().toISOString() })
    )
    .help().argv;

  if ((argv as any)._?.includes("render-minutes")) {
    const doc = renderBoardMinutes({
      orgName: (argv as any).org,
      date: (argv as any).date,
      time: "09:00",
      location: "Virtual"
    });
    console.log(`# ${doc.filename}\n\n${doc.content}\n\nChecksum: ${doc.checksum}`);
  }
}

main();
