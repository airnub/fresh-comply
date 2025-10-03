import { NativeConnection, Worker } from "@temporalio/worker";
import * as croActivities from "./activities/cro.js";
import * as revenueActivities from "./activities/revenue.js";
import * as fileActivities from "./activities/files.js";
import * as utilActivities from "./activities/util.js";
import * as freshnessActivities from "./activities/freshness.js";
import * as externalJobActivities from "./activities/externalJob.js";
import {
  getTaskQueue,
  getTaskQueueForTenant,
  getTemporalAddress,
  getTemporalNamespace,
  getTenantQueueAllowList
} from "./client.js";

async function runWorker() {
  const connection = await NativeConnection.connect({ address: getTemporalAddress() });
  const tenantAllowList = getTenantQueueAllowList();
  const taskQueues = Array.from(
    new Set([
      getTaskQueue(),
      ...tenantAllowList.map((tenantId) => getTaskQueueForTenant(tenantId))
    ])
  );

  const workerOptions = {
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
    }
  } as const;

  const workers = await Promise.all(
    taskQueues.map(async (taskQueue) =>
      Worker.create({
        ...workerOptions,
        taskQueue
      })
    )
  );

  console.log(
    `[temporal-worker] listening on task queues: ${taskQueues.join(", ")}`
  );

  const shutdown = async () => {
    await Promise.all(workers.map((worker) => worker.shutdown()));
    await connection.close();
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await Promise.all(workers.map((worker) => worker.run()));
}

runWorker().catch((error) => {
  console.error("Temporal worker failed", error);
  process.exit(1);
});
