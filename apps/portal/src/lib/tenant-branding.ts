import type { DocumentBrandingMetadata } from "@airnub/doc-templates";

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
  }
};

const CACHE_TTL_MS = 5 * 60 * 1000;

const brandingCache: Map<string, { data: TenantBrandingPayload; expiresAt: number }> = new Map();

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
    updatedAt: row.updatedAt ?? DEFAULT_TENANT_BRANDING.updatedAt
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

    const response = await fetcher(`${credentials.supabaseUrl}/rest/v1/rpc/resolve_tenant_branding`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: credentials.accessToken,
        Authorization: `Bearer ${credentials.accessToken}`
      },
      body: JSON.stringify({ p_host: normalizedHost })
    });

    if (!response.ok) {
      throw new Error(`Failed to resolve tenant branding (${response.status})`);
    }

    const payload = (await response.json()) as Array<Record<string, unknown>>;
    const row = payload?.[0];
    const branding = coalesceBranding({
      tenantOrgId: (row?.tenant_org_id as string | undefined) ?? DEFAULT_TENANT_BRANDING.tenantOrgId,
      domain: (row?.domain as string | undefined) ?? normalizedHost,
      tokens: decodeJsonPayload(row?.tokens) as TenantBrandingTokens | undefined,
      logoUrl: (row?.logo_url as string | undefined) ?? null,
      faviconUrl: (row?.favicon_url as string | undefined) ?? null,
      typography: decodeJsonPayload(row?.typography) as TenantTypographySettings | undefined,
      pdfHeader: decodeJsonPayload(row?.pdf_header) as TenantPdfMetadata | undefined,
      pdfFooter: decodeJsonPayload(row?.pdf_footer) as TenantPdfMetadata | undefined,
      updatedAt: (row?.updated_at as string | undefined) ?? null
    });

    brandingCache.set(normalizedHost, { data: branding, expiresAt: now() + CACHE_TTL_MS });
    return branding;
  } catch (error) {
    console.warn("Tenant branding resolution failed", error);
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
