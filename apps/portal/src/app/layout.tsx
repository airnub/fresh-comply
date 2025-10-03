import "@radix-ui/themes/styles.css";
import "./globals.css";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { CspNonceProvider } from "./csp-nonce-provider";

export const metadata = {
  title: "FreshComply Portal",
  description: "Workflow demo for compliance engagements"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const nonce = headers().get("x-csp-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <body data-csp-nonce={nonce}>
        <CspNonceProvider nonce={nonce}>{children}</CspNonceProvider>
      </body>
    </html>
  );
}
