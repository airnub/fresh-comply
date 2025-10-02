"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Callout, Flex, Text } from "@radix-ui/themes";
import { EyeOpenIcon, EyeNoneIcon } from "@radix-ui/react-icons";

export function ActingForBanner({ engager, client }: { engager: string; client: string }) {
  const [visible, setVisible] = useState(true);
  const t = useTranslations("actingFor");

  if (!visible) {
    return (
      <Button
        variant="ghost"
        color="gray"
        size="2"
        onClick={() => setVisible(true)}
        aria-expanded={visible}
        aria-controls="acting-for-banner"
        type="button"
      >
        <Flex align="center" gap="2">
          <EyeOpenIcon aria-hidden />
          <span>{t("toggleShow")}</span>
        </Flex>
      </Button>
    );
  }

  return (
    <Callout.Root id="acting-for-banner" color="amber" highContrast>
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Flex align="center" gap="3">
          <Callout.Icon>
            <EyeOpenIcon aria-hidden />
          </Callout.Icon>
          <Flex direction="column" gap="1">
            <Text size="1" weight="bold" color="amber">
              {t("badge")}
            </Text>
            <Callout.Text aria-live="polite">
              {t("separator", { engager, client })}
            </Callout.Text>
          </Flex>
        </Flex>
        <Button
          variant="ghost"
          color="amber"
          size="2"
          onClick={() => setVisible(false)}
          aria-expanded={visible}
          aria-controls="acting-for-banner"
          type="button"
        >
          <Flex align="center" gap="2">
            <EyeNoneIcon aria-hidden />
            <span>{t("toggleHide")}</span>
          </Flex>
        </Button>
      </Flex>
    </Callout.Root>
  );
}
