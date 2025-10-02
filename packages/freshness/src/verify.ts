export type Rule = { id: string; name: string; sources: string[]; lastVerifiedAt?: string };

export async function verifyRule(rule: Rule): Promise<Rule> {
  // DEV stub: simply update timestamp; real impl calls connectors/checkers
  return { ...rule, lastVerifiedAt: new Date().toISOString() };
}
