"use client";

import { useTranslations } from "next-intl";
import { useTheme, type ThemePreference } from "@airnub/ui/theme";

const themeOptions: { value: ThemePreference; labelKey: string }[] = [
  { value: "system", labelKey: "system" },
  { value: "light", labelKey: "light" },
  { value: "dark", labelKey: "dark" },
  { value: "high-contrast", labelKey: "contrast" }
];

export function ThemeToggle() {
  const t = useTranslations("theme");
  const { theme, resolvedTheme, resolvedMotion, setTheme, setMotion } = useTheme();

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium" id="theme-toggle-label">
        {t("label")}
      </p>
      <div role="group" aria-labelledby="theme-toggle-label" className="inline-flex flex-wrap gap-2">
        {themeOptions.map((option) => {
          const isActive = theme === option.value || (option.value === resolvedTheme && theme === "system");
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              aria-pressed={isActive}
              className={`rounded border px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                isActive ? "bg-accent text-on-accent" : "bg-surface text-foreground"
              }`}
            >
              {t(option.labelKey)}
            </button>
          );
        })}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={resolvedMotion === "reduced"}
          onChange={(event) => setMotion(event.target.checked ? "reduced" : "auto")}
        />
        {t("reducedMotion")}
      </label>
    </div>
  );
}
