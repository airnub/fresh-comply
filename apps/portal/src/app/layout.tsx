import "@radix-ui/themes/styles.css";
import "./globals.css";
import type { ReactNode } from "react";
import { getCspNonce } from "../lib/csp";

export const metadata = {
  title: "FreshComply Portal",
  description: "Workflow demo for compliance engagements"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const nonce = getCspNonce();

  return (
    <html lang="en" suppressHydrationWarning>
      <body data-csp-nonce={nonce ?? undefined}>
        {children}
      </body>
    </html>
  );
}
