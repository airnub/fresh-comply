import "@radix-ui/themes/styles.css";
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "FreshComply Portal",
  description: "Workflow demo for compliance engagements"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  );
}
