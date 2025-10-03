import "@radix-ui/themes/styles.css";
import "./globals.css";
import type { CSSProperties, ReactNode } from "react";
import { headers } from "next/headers";
import { getCspNonce } from "../lib/csp";
import {
  createBrandingStyleVariables,
  createHtmlBrandingAttributes,
  getTenantBrandingFromHeaders
} from "../lib/tenant-branding";

export const metadata = {
  title: "FreshComply Portal",
  description: "Workflow demo for compliance engagements"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const nonce = getCspNonce();
  const headerStore = headers();
  const branding = getTenantBrandingFromHeaders(headerStore);
  const htmlAttributes = createHtmlBrandingAttributes(branding);
  const styleVariables = createBrandingStyleVariables(branding);
  const htmlStyle = styleVariables as CSSProperties;
  const bodyStyle: CSSProperties = {};

  if (branding.typography?.bodyFont) {
    bodyStyle.fontFamily = branding.typography.bodyFont;
  }

  if (branding.tokens.mode) {
    htmlStyle.colorScheme = branding.tokens.mode === "dark" ? "dark" : "light";
  }

  if (styleVariables["--brand-surface"]) {
    bodyStyle.backgroundColor = styleVariables["--brand-surface"];
  }

  if (styleVariables["--brand-text"]) {
    bodyStyle.color = styleVariables["--brand-text"];
  }

  const htmlDataAttributes = Object.fromEntries(Object.entries(htmlAttributes));

  return (
    <html lang="en" suppressHydrationWarning {...htmlDataAttributes} style={htmlStyle}>
      <body
        data-csp-nonce={nonce ?? undefined}
        data-tenant-org={branding.tenantOrgId}
        style={bodyStyle}
      >
        {children}
      </body>
    </html>
  );
}
