import "./globals.css";
import { ReactNode } from "react";
import { ActingForBanner } from "../components/acting-for-banner";

export const metadata = {
  title: "FreshComply Portal",
  description: "Workflow demo for compliance engagements"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b p-3">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">FreshComply Portal</h1>
              <p className="text-sm text-muted-foreground">Multi-tenant engagements & compliance workflows</p>
            </div>
            <nav className="text-sm">
              <a href="/">Home</a>
            </nav>
          </div>
        </header>
        <main className="p-6">
          <div className="mx-auto max-w-5xl">
            <ActingForBanner engager="Company A" client="Company X" />
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
