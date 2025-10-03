import { Worker } from "@temporalio/worker";
import * as croActivities from "./activities/cro.js";
import * as revenueActivities from "./activities/revenue.js";
import * as fileActivities from "./activities/files.js";
import * as utilActivities from "./activities/util.js";
import * as freshnessActivities from "./activities/freshness.js";
import * as externalJobActivities from "./activities/externalJob.js";
import { createTemporalConnection, getTaskQueue, getTemporalNamespace } from "./client.js";

async function runWorker() {
  const connection = await createTemporalConnection();
  const worker = await Worker.create({
    connection,
    namespace: getTemporalNamespace(),
    workflowsPath: new URL("./workflows", import.meta.url).pathname,
    activities: {
      ...croActivities,
      ...revenueActivities,
      ...fileActivities,
      ...utilActivities,
      ...externalJobActivities,
      ...freshnessActivities
    },
    taskQueue: getTaskQueue()
  });

  const shutdown = async () => {
    await worker.shutdown();
    await connection.close();
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await worker.run();
}

runWorker().catch((error) => {
  console.error("Temporal worker failed", error);
  process.exit(1);
});
