import type { DocumentBrandingMetadata } from "@airnub/doc-templates";
import { getServiceSupabaseClient } from "@airnub/utils/supabase-service";

export interface TenantBrandingTokens {
  themeId?: string;
  mode?: "light" | "dark";
  cssVariables?: Record<string, string>;
  palette?: Record<string, string>;
  [key: string]: unknown;
}

export interface TenantTypographySettings {
  bodyFont?: string;
  headingFont?: string;
  fallbackStack?: string;
  [key: string]: unknown;
}

export interface TenantPdfMetadata {
  text?: string;
  logoUrl?: string;
  disclaimer?: string;
  [key: string]: unknown;
}

export interface TenantBrandingPayload {
  tenantOrgId: string;
  domain: string;
  tokens: TenantBrandingTokens;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  typography?: TenantTypographySettings | null;
  pdfHeader?: TenantPdfMetadata | null;
  pdfFooter?: TenantPdfMetadata | null;
  updatedAt?: string | null;
  realmId?: string | null;
  providerOrgId?: string | null;
}

const DEFAULT_CSS_VARIABLES: Record<string, string> = {
  "--brand-primary": "#0D47A1",
  "--brand-accent": "#00B8A9",
  "--brand-surface": "#FFFFFF",
  "--brand-surface-alt": "#F5F7FA",
  "--brand-text": "#1F2933",
  "--brand-muted": "#52606D"
};

export const DEFAULT_TENANT_BRANDING: TenantBrandingPayload = {
  tenantOrgId: "platform",
  domain: "",
  tokens: {
    themeId: "freshcomply",
    mode: "light",
    cssVariables: DEFAULT_CSS_VARIABLES,
    palette: {
      primary: "#0D47A1",
      accent: "#00B8A9",
      text: "#1F2933",
      muted: "#52606D",
      surface: "#FFFFFF"
    }
  },
  logoUrl: null,
  faviconUrl: null,
  typography: {
    bodyFont: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    headingFont: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  pdfHeader: {
    text: "FreshComply"
  },
  pdfFooter: {
    text: "FreshComply — Compliance Simplified"
  },
  realmId: null,
  providerOrgId: null
};

const CACHE_TTL_MS = 5 * 60 * 1000;

const brandingCache: Map<string, { data: TenantBrandingPayload; expiresAt: number }> = new Map();

export class TenantBrandingResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantBrandingResolutionError";
  }
}

function now() {
  return Date.now();
}

function normalizeHost(host: string | null | undefined): string | null {
  if (!host) {
    return null;
  }
  const trimmed = host.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.toLowerCase().split(":")[0];
}

function readEnv(name: string): string | undefined {
  try {
    return process.env[name];
  } catch {
    return undefined;
  }
}

function ensureSupabaseEnv() {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL") ?? readEnv("SUPABASE_URL");
  const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? readEnv("SUPABASE_ANON_KEY");

  if (!url || !anonKey) {
    throw new Error("Supabase URL and anon key must be configured for tenant branding resolution.");
  }

  return { url, anonKey };
}

function decodeJsonPayload(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

export function encodeTenantBrandingHeader(payload: TenantBrandingPayload): string {
  const json = JSON.stringify(payload);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf8").toString("base64");
  }
  if (typeof btoa !== "undefined" && typeof TextEncoder !== "undefined") {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(json);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }
  return json;
}

export function decodeTenantBrandingHeader(value: string | null | undefined): TenantBrandingPayload | null {
  if (!value) {
    return null;
  }

  try {
    let json: string;
    if (typeof Buffer !== "undefined") {
      json = Buffer.from(value, "base64").toString("utf8");
    } else if (typeof atob !== "undefined" && typeof TextDecoder !== "undefined") {
      const binary = atob(value);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const decoder = new TextDecoder();
      json = decoder.decode(bytes);
    } else {
      json = value;
    }
    const parsed = JSON.parse(json) as TenantBrandingPayload;
    return parsed;
  } catch (error) {
    console.warn("Unable to decode tenant branding header", error);
    return null;
  }
}

function coalesceBranding(row: Partial<TenantBrandingPayload> | null | undefined): TenantBrandingPayload {
  if (!row) {
    return DEFAULT_TENANT_BRANDING;
  }

  const tokens: TenantBrandingTokens = {
    ...DEFAULT_TENANT_BRANDING.tokens,
    ...(row.tokens ?? {})
  };

  tokens.cssVariables = {
    ...DEFAULT_CSS_VARIABLES,
    ...(row.tokens?.cssVariables ?? row.tokens?.palette ?? {} as Record<string, string>),
    ...(row.tokens?.cssVariables ?? {})
  };

  return {
    tenantOrgId: row.tenantOrgId ?? DEFAULT_TENANT_BRANDING.tenantOrgId,
    domain: row.domain ?? DEFAULT_TENANT_BRANDING.domain,
    tokens,
    logoUrl: row.logoUrl ?? DEFAULT_TENANT_BRANDING.logoUrl,
    faviconUrl: row.faviconUrl ?? DEFAULT_TENANT_BRANDING.faviconUrl,
    typography: (row.typography as TenantTypographySettings | null | undefined) ?? DEFAULT_TENANT_BRANDING.typography,
    pdfHeader: (row.pdfHeader as TenantPdfMetadata | null | undefined) ?? DEFAULT_TENANT_BRANDING.pdfHeader,
    pdfFooter: (row.pdfFooter as TenantPdfMetadata | null | undefined) ?? DEFAULT_TENANT_BRANDING.pdfFooter,
    updatedAt: row.updatedAt ?? DEFAULT_TENANT_BRANDING.updatedAt,
    realmId: row.realmId ?? DEFAULT_TENANT_BRANDING.realmId ?? null,
    providerOrgId: row.providerOrgId ?? DEFAULT_TENANT_BRANDING.providerOrgId ?? null
  };
}

export function createHtmlBrandingAttributes(branding: TenantBrandingPayload) {
  const attrs: Record<string, string> = {
    "data-tenant": branding.tenantOrgId
  };

  if (branding.tokens.themeId) {
    attrs["data-theme"] = branding.tokens.themeId;
  }

  if (branding.tokens.mode) {
    attrs["data-theme-mode"] = branding.tokens.mode;
    attrs["data-color-scheme"] = branding.tokens.mode === "dark" ? "dark" : "light";
  }

  return attrs;
}

export function createBrandingStyleVariables(branding: TenantBrandingPayload): Record<string, string> {
  const cssVars: Record<string, string> = {
    ...DEFAULT_CSS_VARIABLES,
    ...(branding.tokens.cssVariables ?? {})
  };

  if (branding.typography?.bodyFont) {
    cssVars["--brand-font-body"] = branding.typography.bodyFont;
  }
  if (branding.typography?.headingFont) {
    cssVars["--brand-font-heading"] = branding.typography.headingFont;
  }

  return cssVars;
}

export function getTenantBrandingFromHeaders(headers: Headers | ReadonlyHeaders | undefined): TenantBrandingPayload {
  try {
    const headerValue = headers?.get?.("x-tenant-branding");
    const decoded = decodeTenantBrandingHeader(headerValue ?? undefined);
    if (decoded) {
      return coalesceBranding(decoded);
    }
  } catch (error) {
    console.warn("Unable to parse tenant branding from headers", error);
  }
  return DEFAULT_TENANT_BRANDING;
}

type ReadonlyHeaders = Pick<Headers, "get">;

type ResolveTenantBrandingCredentials = {
  supabaseUrl: string;
  accessToken: string;
};

export type ResolveTenantBrandingOptions = {
  credentials?: ResolveTenantBrandingCredentials;
  fetchImpl?: typeof fetch;
};

type ResolveTenantBrandingRpcRow = {
  org_id: string | null;
  domain: string | null;
  tokens: Record<string, unknown> | null;
  logo_url: string | null;
  favicon_url: string | null;
  typography: Record<string, unknown> | null;
  pdf_header: Record<string, unknown> | null;
  pdf_footer: Record<string, unknown> | null;
  updated_at: string | null;
} | null;

async function fetchTenantBrandingRpcRow(
  fetcher: typeof fetch,
  credentials: ResolveTenantBrandingCredentials,
  host: string
): Promise<ResolveTenantBrandingRpcRow> {
  const response = await fetcher(`${credentials.supabaseUrl}/rest/v1/rpc/resolve_tenant_branding`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: credentials.accessToken,
      Authorization: `Bearer ${credentials.accessToken}`
    },
    body: JSON.stringify({ p_host: host })
  });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to resolve tenant branding via RPC (${response.status})`);
  }

  const payload = await response.json();
  if (Array.isArray(payload)) {
    return (payload[0] ?? null) as ResolveTenantBrandingRpcRow;
  }
  return (payload ?? null) as ResolveTenantBrandingRpcRow;
}

function ensureTenantOrgId(row: ResolveTenantBrandingRpcRow, host: string): string {
  const orgId = row?.org_id ?? null;
  if (!orgId) {
    throw new TenantBrandingResolutionError(`resolve_tenant_branding returned no org_id for host ${host}`);
  }
  return orgId;
}

export async function resolveTenantBranding(
  host: string | null | undefined,
  options?: ResolveTenantBrandingOptions
): Promise<TenantBrandingPayload> {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) {
    return DEFAULT_TENANT_BRANDING;
  }

  const cached = brandingCache.get(normalizedHost);
  if (cached && cached.expiresAt > now()) {
    return cached.data;
  }

  try {
    if (typeof window !== "undefined") {
      // Browser execution falls back to the public REST endpoint.
      const { url, anonKey } = ensureSupabaseEnv();
      const credentials: ResolveTenantBrandingCredentials = {
        supabaseUrl: url,
        accessToken: anonKey
      };
      const rpcRow = await fetchTenantBrandingRpcRow(globalThis.fetch ?? fetch, credentials, normalizedHost);
      const tenantOrgId = ensureTenantOrgId(rpcRow, normalizedHost);
      const response = await fetch(
        `${url}/rest/v1/realms?domain=eq.${encodeURIComponent(normalizedHost)}`,
        {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to resolve realm (${response.status})`);
      }

      const payload = (await response.json()) as Array<Record<string, unknown>>;
      const realmRow = payload?.[0];
      if (!realmRow) {
        throw new TenantBrandingResolutionError(`No tenant realm configured for host ${normalizedHost}`);
      }
      const branding = coalesceBranding({
        tenantOrgId,
        providerOrgId: (realmRow?.provider_org_id as string | undefined) ?? null,
        realmId: (realmRow?.id as string | undefined) ?? null,
        domain: normalizedHost,
        tokens: (rpcRow?.tokens as TenantBrandingTokens | undefined) ?? undefined,
        logoUrl: (rpcRow?.logo_url as string | undefined) ?? null,
        faviconUrl: (rpcRow?.favicon_url as string | undefined) ?? null,
        typography: decodeJsonPayload(rpcRow?.typography) as TenantTypographySettings | undefined,
        pdfHeader: decodeJsonPayload(rpcRow?.pdf_header) as TenantPdfMetadata | undefined,
        pdfFooter: decodeJsonPayload(rpcRow?.pdf_footer) as TenantPdfMetadata | undefined,
        updatedAt: (rpcRow?.updated_at as string | undefined) ?? null
      });

      brandingCache.set(normalizedHost, { data: branding, expiresAt: now() + CACHE_TTL_MS });
      return branding;
    }

    const credentials: ResolveTenantBrandingCredentials =
      options?.credentials ??
      (() => {
        const { url, anonKey } = ensureSupabaseEnv();
        return { supabaseUrl: url, accessToken: anonKey } satisfies ResolveTenantBrandingCredentials;
      })();

    const fetcher = options?.fetchImpl ?? globalThis.fetch;

    if (!fetcher) {
      throw new Error("A fetch implementation must be provided to resolve tenant branding.");
    }

    const rpcRow = await fetchTenantBrandingRpcRow(fetcher, credentials, normalizedHost);
    const tenantOrgId = ensureTenantOrgId(rpcRow, normalizedHost);
    const env = typeof process !== "undefined" ? process.env : undefined;
    const hasServiceCredentials =
      typeof env === "object" &&
      env !== null &&
      "SUPABASE_SERVICE_ROLE_KEY" in env &&
      "SUPABASE_URL" in env;

    let providerOrgId: string | null = null;
    let realmId: string | null = null;
    let updatedAt: string | null = (rpcRow?.updated_at as string | undefined) ?? null;

    if (hasServiceCredentials) {
      const supabase = getServiceSupabaseClient();
      const { data, error } = await supabase
        .from("realms")
        .select("id, domain, provider_org_id, updated_at")
        .eq("domain", normalizedHost)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to resolve realm via service client: ${error.message}`);
      }

      if (!data) {
        throw new TenantBrandingResolutionError(`No tenant realm configured for host ${normalizedHost}`);
      }

      providerOrgId = data.provider_org_id ?? null;
      realmId = data.id ?? null;
      updatedAt = data.updated_at ?? updatedAt;
    } else {
      const response = await fetcher(
        `${credentials.supabaseUrl}/rest/v1/realms?domain=eq.${encodeURIComponent(normalizedHost)}`,
        {
          headers: {
            apikey: credentials.accessToken,
            Authorization: `Bearer ${credentials.accessToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to resolve realm (${response.status})`);
      }

      const payload = (await response.json()) as Array<Record<string, unknown>>;
      const realmRow = payload?.[0];
      if (!realmRow) {
        throw new TenantBrandingResolutionError(`No tenant realm configured for host ${normalizedHost}`);
      }

      providerOrgId = (realmRow?.provider_org_id as string | undefined) ?? null;
      realmId = (realmRow?.id as string | undefined) ?? null;
      updatedAt = (realmRow?.updated_at as string | undefined) ?? updatedAt;
    }

    const branding = coalesceBranding({
      tenantOrgId,
      providerOrgId,
      realmId,
      domain: normalizedHost,
      tokens: (rpcRow?.tokens as TenantBrandingTokens | undefined) ?? undefined,
      logoUrl: (rpcRow?.logo_url as string | undefined) ?? null,
      faviconUrl: (rpcRow?.favicon_url as string | undefined) ?? null,
      typography: decodeJsonPayload(rpcRow?.typography) as TenantTypographySettings | undefined,
      pdfHeader: decodeJsonPayload(rpcRow?.pdf_header) as TenantPdfMetadata | undefined,
      pdfFooter: decodeJsonPayload(rpcRow?.pdf_footer) as TenantPdfMetadata | undefined,
      updatedAt
    });

    brandingCache.set(normalizedHost, { data: branding, expiresAt: now() + CACHE_TTL_MS });
    return branding;
  } catch (error) {
    console.warn("Tenant branding resolution failed", error);
    if (error instanceof TenantBrandingResolutionError) {
      throw error;
    }
    const fallback = DEFAULT_TENANT_BRANDING;
    brandingCache.set(normalizedHost, { data: fallback, expiresAt: now() + CACHE_TTL_MS });
    return fallback;
  }
}

export function getTenantOrgIdFromBranding(branding: TenantBrandingPayload): string {
  return branding.tenantOrgId;
}

export function toDocumentBrandingMetadata(branding: TenantBrandingPayload): DocumentBrandingMetadata {
  const cssVars = createBrandingStyleVariables(branding);
  return {
    header: {
      text: branding.pdfHeader?.text ?? undefined,
      logoUrl: branding.logoUrl ?? undefined,
      accentColor:
        branding.tokens.palette?.primary ?? cssVars["--brand-primary"] ?? cssVars["--brand-accent"] ?? undefined
    },
    footer: {
      text: branding.pdfFooter?.text ?? undefined,
      accentColor: branding.tokens.palette?.accent ?? cssVars["--brand-accent"] ?? undefined,
      disclaimer: branding.pdfFooter?.disclaimer ?? undefined
    },
    typography: {
      bodyFont: branding.typography?.bodyFont ?? undefined,
      headingFont: branding.typography?.headingFont ?? undefined
    },
    palette: branding.tokens.palette ?? undefined
  } satisfies DocumentBrandingMetadata;
}
