import { randomBytes } from "node:crypto";

export type SecurityHeaderConfig = {
  cspEnabled: boolean;
  cspReportOnly: boolean;
  defaultSrc: string[];
  scriptSrc: string[];
  styleSrc: string[];
  imgSrc: string[];
  fontSrc: string[];
  connectSrc: string[];
  frameAncestors: string[];
  formAction: string[];
  reportUri?: string;
  hstsEnabled: boolean;
  hstsMaxAge: number;
  hstsIncludeSubdomains: boolean;
  hstsPreload: boolean;
  frameOptions: string;
  referrerPolicy: string;
};

type SecurityHeaderState = {
  config: SecurityHeaderConfig;
};

const BOOL_TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const BOOL_FALSE_VALUES = new Set(["0", "false", "no", "off"]);

const defaultState: SecurityHeaderState = {
  config: {
    cspEnabled: readBoolean("SECURITY_CSP_ENABLED", true),
    cspReportOnly: readBoolean("SECURITY_CSP_REPORT_ONLY", false),
    defaultSrc: readList("SECURITY_CSP_DEFAULT_SRC", ["'self'"]),
    scriptSrc: readList("SECURITY_CSP_SCRIPT_SRC", ["'self'", "https:"], true),
    styleSrc: readList("SECURITY_CSP_STYLE_SRC", ["'self'", "https:"], true),
    imgSrc: readList("SECURITY_CSP_IMG_SRC", ["'self'", "data:", "https:"], true),
    fontSrc: readList("SECURITY_CSP_FONT_SRC", ["'self'", "data:"], true),
    connectSrc: readList("SECURITY_CSP_CONNECT_SRC", ["'self'", "https:"], true),
    frameAncestors: readList("SECURITY_CSP_FRAME_ANCESTORS", ["'none'"], true),
    formAction: readList("SECURITY_CSP_FORM_ACTION", ["'self'"], true),
    reportUri: process.env.SECURITY_CSP_REPORT_URI?.trim() || undefined,
    hstsEnabled: readBoolean("SECURITY_HSTS_ENABLED", true),
    hstsMaxAge: readNumber("SECURITY_HSTS_MAX_AGE", 31536000),
    hstsIncludeSubdomains: readBoolean("SECURITY_HSTS_INCLUDE_SUBDOMAINS", true),
    hstsPreload: readBoolean("SECURITY_HSTS_PRELOAD", false),
    frameOptions: process.env.SECURITY_FRAME_OPTIONS?.trim() || "DENY",
    referrerPolicy: process.env.SECURITY_REFERRER_POLICY?.trim() || "strict-origin-when-cross-origin"
  }
};

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (BOOL_TRUE_VALUES.has(normalized)) return true;
  if (BOOL_FALSE_VALUES.has(normalized)) return false;
  return fallback;
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readList(name: string, fallback: string[], allowEmpty = false): string[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  const values = raw
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length === 0 && !allowEmpty) {
    return fallback;
  }
  return values;
}

export function generateNonce(size = 16): string {
  return randomBytes(size).toString("base64");
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function buildDirective(name: string, values: string[]): string | null {
  if (!values.length) {
    return null;
  }
  const directive = values.join(" ");
  return `${name} ${directive}`;
}

function buildContentSecurityPolicy(nonce: string, config: SecurityHeaderConfig): string {
  const directives: Array<string | null> = [];
  const scriptValues = unique([...config.scriptSrc, `'nonce-${nonce}'`, "'strict-dynamic'"]);
  const styleValues = unique([...config.styleSrc, `'nonce-${nonce}'`]);

  directives.push(buildDirective("default-src", unique(config.defaultSrc)));
  directives.push(buildDirective("base-uri", ["'self'"]));
  directives.push(buildDirective("object-src", ["'none'"]));
  directives.push(buildDirective("script-src", scriptValues));
  directives.push(buildDirective("style-src", styleValues));
  directives.push(buildDirective("img-src", unique(config.imgSrc)));
  directives.push(buildDirective("font-src", unique(config.fontSrc)));
  directives.push(buildDirective("connect-src", unique(config.connectSrc)));
  directives.push(buildDirective("frame-ancestors", unique(config.frameAncestors)));
  directives.push(buildDirective("form-action", unique(config.formAction)));
  if (config.reportUri) {
    directives.push(buildDirective("report-uri", [config.reportUri]));
  }

  return directives.filter((directive): directive is string => Boolean(directive)).join("; ");
}

export function resolveSecurityHeaders(params: { nonce: string; protocol?: string }): Record<string, string> {
  const { nonce, protocol } = params;
  const headers: Record<string, string> = {};
  const config = defaultState.config;

  if (config.cspEnabled) {
    const csp = buildContentSecurityPolicy(nonce, config);
    const headerName = config.cspReportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
    headers[headerName] = csp;
  }

  const isHttps = (protocol ?? "https:").startsWith("https");
  if (config.hstsEnabled && isHttps) {
    const directives = [`max-age=${config.hstsMaxAge}`];
    if (config.hstsIncludeSubdomains) {
      directives.push("includeSubDomains");
    }
    if (config.hstsPreload) {
      directives.push("preload");
    }
    headers["Strict-Transport-Security"] = directives.join("; ");
  }

  headers["X-Frame-Options"] = config.frameOptions;
  headers["Referrer-Policy"] = config.referrerPolicy;
  headers["X-Content-Type-Options"] = "nosniff";
  headers["Cross-Origin-Opener-Policy"] = "same-origin";
  headers["Cross-Origin-Resource-Policy"] = "same-origin";

  return headers;
}
