import "@radix-ui/themes/styles.css";
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "FreshComply Admin",
  description: "Back-office administration for FreshComply",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-surface text-foreground">
        {children}
      </body>
    </html>
  );
}
