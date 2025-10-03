export interface ChannelConfig {
  signal?: string;
  signatureSecretAlias?: string;
  toleranceSeconds?: number;
  nonceTtlSeconds?: number;
}

const CHANNEL_REGISTRY: Record<string, Record<string, ChannelConfig>> = {
  "tenant-x": {
    "sysY-enrich": {
      signal: "receivedCallback",
      signatureSecretAlias: "secrets.webhooks.sysY",
      toleranceSeconds: 5 * 60,
      nonceTtlSeconds: 10 * 60
    }
  }
};

export function resolveChannelConfig(tenantId: string, channel: string): ChannelConfig | undefined {
  const tenantConfig = CHANNEL_REGISTRY[tenantId];
  if (!tenantConfig) {
    return undefined;
  }
  return tenantConfig[channel];
}
