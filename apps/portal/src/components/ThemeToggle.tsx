"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Button, Flex, Switch, Text } from "@radix-ui/themes";
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
  const switchId = useId();

  return (
    <Flex direction="column" gap="3">
      <Text as="p" size="2" weight="medium" id="theme-toggle-label">
        {t("label")}
      </Text>
      <Flex role="group" aria-labelledby="theme-toggle-label" gap="2" wrap="wrap">
        {themeOptions.map((option) => {
          const isActive = theme === option.value || (option.value === resolvedTheme && theme === "system");
          return (
            <Button
              key={option.value}
              type="button"
              variant={isActive ? "solid" : "surface"}
              color="blue"
              size="2"
              onClick={() => setTheme(option.value)}
              aria-pressed={isActive}
            >
              {t(option.labelKey)}
            </Button>
          );
        })}
      </Flex>
      <Flex align="center" gap="2">
        <Switch
          id={switchId}
          checked={resolvedMotion === "reduced"}
          onCheckedChange={(checked) => setMotion(checked ? "reduced" : "auto")}
        />
        <Text asChild size="2">
          <label htmlFor={switchId}>{t("reducedMotion")}</label>
        </Text>
      </Flex>
    </Flex>
  );
}
