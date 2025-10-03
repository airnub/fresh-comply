const SECURITY_NONCE_HEADER = "x-csp-nonce";

function encodeBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function generateNonce(size = 16): string {
  const buffer = new Uint8Array(size);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(buffer);
  } else {
    throw new Error("crypto.getRandomValues is not available in this runtime");
  }

  return encodeBase64(buffer);
}

function parseListEnv(name: string, defaults: string[]): string[] {
  const value = process.env[name];
  if (!value) {
    return defaults;
  }

  const extras = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return Array.from(new Set([...defaults, ...extras]));
}

function buildCspDirectives(nonce: string): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
    "script-src": parseListEnv("SECURITY_CSP_SCRIPT_SRC", ["'self'", "'strict-dynamic'"]),
    "style-src": parseListEnv("SECURITY_CSP_STYLE_SRC", ["'self'", "'unsafe-inline'"]),
    "img-src": parseListEnv("SECURITY_CSP_IMG_SRC", ["'self'", "data:", "blob:"]),
    "font-src": parseListEnv("SECURITY_CSP_FONT_SRC", ["'self'", "data:"]),
    "connect-src": parseListEnv("SECURITY_CSP_CONNECT_SRC", ["'self'"]),
    "frame-ancestors": parseListEnv("SECURITY_CSP_FRAME_ANCESTORS", ["'self'"])
  };

  directives["script-src"] = Array.from(
    new Set([...directives["script-src"], `'nonce-${nonce}'`])
  );
  directives["style-src"] = Array.from(
    new Set([...directives["style-src"], `'nonce-${nonce}'`])
  );

  const frameSrc = parseListEnv("SECURITY_CSP_FRAME_SRC", []);
  if (frameSrc.length > 0) {
    directives["frame-src"] = frameSrc;
  }

  const reportUri = process.env.SECURITY_CSP_REPORT_URI;
  const serialized = Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ");

  if (reportUri) {
    return `${serialized}; report-uri ${reportUri}`;
  }

  return serialized;
}

function boolFromEnv(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) {
    return defaultValue;
  }
  return value === "1" || value.toLowerCase() === "true";
}

function buildStrictTransportSecurity(): string | null {
  if (!boolFromEnv("SECURITY_ENABLE_HSTS", true)) {
    return null;
  }

  const maxAge = Number.parseInt(process.env.SECURITY_HSTS_MAX_AGE ?? "63072000", 10);
  const includeSubDomains = boolFromEnv("SECURITY_HSTS_INCLUDE_SUBDOMAINS", true);
  const preload = boolFromEnv("SECURITY_HSTS_PRELOAD", false);

  const parts = [`max-age=${Number.isFinite(maxAge) ? maxAge : 63072000}`];
  if (includeSubDomains) {
    parts.push("includeSubDomains");
  }
  if (preload) {
    parts.push("preload");
  }

  return parts.join("; ");
}

export function buildSecurityHeaders(nonce: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": buildCspDirectives(nonce),
    "Referrer-Policy": process.env.SECURITY_REFERRER_POLICY ?? "no-referrer",
    "X-Frame-Options": process.env.SECURITY_X_FRAME_OPTIONS ?? "DENY",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": process.env.SECURITY_CROSS_ORIGIN_RESOURCE_POLICY ?? "same-origin",
    "Cross-Origin-Opener-Policy": process.env.SECURITY_CROSS_ORIGIN_OPENER_POLICY ?? "same-origin"
  };

  const permissionsPolicy = process.env.SECURITY_PERMISSIONS_POLICY;
  if (permissionsPolicy) {
    headers["Permissions-Policy"] = permissionsPolicy;
  }

  const coep = process.env.SECURITY_CROSS_ORIGIN_EMBEDDER_POLICY;
  if (coep) {
    headers["Cross-Origin-Embedder-Policy"] = coep;
  }

  const hsts = buildStrictTransportSecurity();
  if (hsts) {
    headers["Strict-Transport-Security"] = hsts;
  }

  headers[SECURITY_NONCE_HEADER] = nonce;
  return headers;
}

export { SECURITY_NONCE_HEADER };
