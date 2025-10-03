import type { SupabaseClient } from "@supabase/supabase-js";
import type { RuleVerificationEvidence } from "@airnub/engine/types";
import type { Database, Json } from "@airnub/types/supabase";
import type { SourceKey, SourceRecord } from "./watcher.js";
import { buildFingerprint, fetchSourceRecords } from "./watcher.js";

export type RuleEvidence = {
  sourceKey: SourceKey;
  fetchedAt: string;
  recordCount: number;
  sample: SourceRecord[];
  fingerprint: string;
  expectedFingerprint?: string;
  matches?: boolean;
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
  verification?: RuleVerificationEvidence;
};

export async function verifyRule(rule: Rule, options: VerifyRuleOptions = {}): Promise<Rule> {
  if (options.verification) {
    return await applyVerification(rule, options.verification, options.supabase);
  }

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
        fingerprint,
        expectedFingerprint: fingerprint,
        matches: true
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

async function applyVerification(
  rule: Rule,
  verification: RuleVerificationEvidence,
  client?: SupabaseClient<Database>
): Promise<Rule> {
  const evidence = verification.sources.map((source) => ({
    sourceKey: source.sourceKey as SourceKey,
    fetchedAt: source.fetchedAt,
    recordCount: source.recordCount,
    sample: source.sample,
    fingerprint: source.observedFingerprint,
    expectedFingerprint: source.expectedFingerprint,
    matches: source.matches
  } satisfies RuleEvidence));

  if (client) {
    await persistVerification(client, rule.id, evidence, verification.verifiedAt);
  }

  return {
    ...rule,
    sources: evidence.map((item) => item.sourceKey),
    lastVerifiedAt: verification.verifiedAt,
    status: verification.status,
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
