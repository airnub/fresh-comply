import { proxyActivities } from "@temporalio/workflow";
import type { SourceKey } from "@airnub/freshness/watcher";
import type * as freshnessActivities from "../activities/freshness.js";

const activities = proxyActivities<typeof freshnessActivities>({
  startToCloseTimeout: "10 minutes",
  retry: { maximumAttempts: 1 }
});

export interface FreshnessRefreshWorkflowInput {
  sourceKeys?: SourceKey[];
  workflows?: string[];
}

export async function freshnessRefreshWorkflow(input: FreshnessRefreshWorkflowInput = {}) {
  if (!input.sourceKeys || input.sourceKeys.length === 0) {
    const events = await activities.refreshAllSources({ workflows: input.workflows });
    return { refreshedSources: events.length };
  }

  let refreshed = 0;
  for (const sourceKey of input.sourceKeys) {
    const event = await activities.refreshFreshnessSource({
      sourceKey,
      workflows: input.workflows
    });
    if (event) {
      refreshed += 1;
    }
  }
  return { refreshedSources: refreshed };
}
