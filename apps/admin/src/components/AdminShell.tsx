import type { ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { clsx } from "clsx";

export interface AdminShellProps {
  children: ReactNode;
  navigation?: {
    href: string;
    label: string;
    icon?: ReactNode;
    roles?: string[];
  }[];
  activeHref?: string;
}

export function AdminShell({ children, navigation = [], activeHref }: AdminShellProps) {
  const locale = useLocale();
  const tNav = useTranslations("navigation");

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between lg:flex-col lg:items-start lg:gap-4">
          <div>
            <p className="text-sm font-semibold tracking-wide text-gray-500">FreshComply</p>
            <h1 className="text-xl font-bold text-gray-900">{tNav("title")}</h1>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">{tNav("adminBadge")}</span>
        </div>
        <nav aria-label={tNav("primary")}
          className="mt-6 flex flex-col gap-1 text-sm font-medium text-gray-600">
          {navigation.map((item) => {
            const href = `/${locale}${item.href}`;
            const isActive = activeHref ? activeHref === item.href : false;
            return (
              <Link
                key={item.href}
                href={href}
                className={clsx(
                  "rounded-md px-3 py-2 transition-colors", 
                  isActive ? "bg-blue-600 text-white" : "hover:bg-gray-100"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 bg-surface px-6 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          {children}
        </div>
      </main>
    </div>
  );
}
