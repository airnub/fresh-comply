import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@airnub/types/supabase";
import type { SourceKey, SourceRecord } from "./watcher.js";
import { buildFingerprint, fetchSourceRecords } from "./watcher.js";

export type RuleEvidence = {
  sourceKey: SourceKey;
  fetchedAt: string;
  recordCount: number;
  sample: SourceRecord[];
  fingerprint: string;
};

export type RuleStatus = "verified" | "stale";

export type Rule = {
  id: string;
  name: string;
  sources: SourceKey[];
  lastVerifiedAt?: string;
  status?: RuleStatus;
  evidence?: RuleEvidence[];
};

export type VerifyRuleOptions = {
  supabase?: SupabaseClient<Database>;
};

export async function verifyRule(rule: Rule, options: VerifyRuleOptions = {}): Promise<Rule> {
  const now = new Date().toISOString();
  const evidence = await Promise.all(
    rule.sources.map(async (sourceKey) => {
      const records = await fetchSourceRecords(sourceKey);
      const fingerprint = buildFingerprint(records);
      return {
        sourceKey,
        fetchedAt: now,
        recordCount: records.length,
        sample: records.slice(0, 5),
        fingerprint
      } satisfies RuleEvidence;
    })
  );

  if (options.supabase) {
    await persistVerification(options.supabase, rule.id, evidence, now);
  }

  return {
    ...rule,
    lastVerifiedAt: now,
    status: "verified",
    evidence
  } satisfies Rule;
}

async function persistVerification(
  client: SupabaseClient<Database>,
  ruleId: string,
  evidence: RuleEvidence[],
  verifiedAt: string
) {
  const record = {
    rule_id: ruleId,
    evidence: evidence as unknown as Json,
    verified_at: verifiedAt
  } satisfies Database["public"]["Tables"]["freshness_rule_verifications"]["Insert"];
  const { error } = await client.from("freshness_rule_verifications").insert(record);
  if (error?.code === "42P01") {
    console.warn("freshness_rule_verifications table missing; skipping persistence");
    return;
  }
  if (error) {
    console.warn(`Unable to persist verification for rule ${ruleId}`, error);
  }
}
