import { randomUUID } from "node:crypto";

const SECRET_CACHE = new Map<string, string>();

function formatCacheKey(tenantId: string, alias: string): string {
  return `${tenantId}::${alias}`;
}

function sanitizeIdentifier(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_{2,}/g, "_")
    .toUpperCase();
}

function candidateEnvKeys(tenantId: string, alias: string): string[] {
  const tenantKey = sanitizeIdentifier(tenantId);
  const aliasKey = sanitizeIdentifier(alias);
  return [
    `FC_SECRET_${tenantKey}__${aliasKey}`,
    `FC_SECRET__${aliasKey}`,
    `SECRET_${tenantKey}__${aliasKey}`,
    `SECRET__${aliasKey}`
  ];
}

export class SecretAliasResolutionError extends Error {
  constructor(alias: string, tenantId: string) {
    super(`Unable to resolve secret alias "${alias}" for tenant "${tenantId}".`);
    this.name = "SecretAliasResolutionError";
  }
}

export function resolveSecretAlias(tenantId: string, alias: string): string {
  if (!tenantId || !alias) {
    throw new SecretAliasResolutionError(alias, tenantId);
  }

  const cacheKey = formatCacheKey(tenantId, alias);
  if (SECRET_CACHE.has(cacheKey)) {
    return SECRET_CACHE.get(cacheKey)!;
  }

  const envKeys = candidateEnvKeys(tenantId, alias);
  for (const key of envKeys) {
    const value = process.env[key];
    if (typeof value === "string" && value.length > 0) {
      SECRET_CACHE.set(cacheKey, value);
      return value;
    }
  }

  throw new SecretAliasResolutionError(alias, tenantId);
}

export function clearSecretCache() {
  SECRET_CACHE.clear();
}

export function getSecretCacheDebugSnapshot(): Array<{ key: string; length: number }> {
  return Array.from(SECRET_CACHE.entries()).map(([key, value]) => ({
    key,
    length: value.length
  }));
}

export function generateNonce(): string {
  return randomUUID();
}
