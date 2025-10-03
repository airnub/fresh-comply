"use client";

import { FormEvent, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Box, Button, Callout, Flex, Text } from "@radix-ui/themes";
import { getSupabaseBrowserClient } from "../lib/supabase/browser-client";

type SignInFormProps = {
  redirectTo: string;
  destinationLabel: string;
};

type RequestStatus = "idle" | "loading" | "success";

export function SignInForm({ redirectTo, destinationLabel }: SignInFormProps) {
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const t = useTranslations("auth");
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setStatus("loading");

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email");

    if (typeof email !== "string" || email.trim().length === 0) {
      setErrorMessage(t("error"));
      setStatus("idle");
      return;
    }

    try {
      const origin = window.location.origin;
      const emailRedirectTo = `${origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo }
      });

      if (error) {
        setErrorMessage(error.message ?? t("error"));
        setStatus("idle");
        return;
      }

      setStatus("success");
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t("error"));
      }
      setStatus("idle");
    }
  };

  return (
    <Flex asChild direction="column" gap="4">
      <form onSubmit={handleSubmit} noValidate>
          <Flex direction="column" gap="3">
            <label htmlFor="email" aria-label={t("emailLabel")}>
              <Flex direction="column" gap="2">
                <Text as="span" size="2" weight="medium">
                  {t("emailLabel")}
                </Text>
                <Box>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    aria-invalid={errorMessage ? "true" : "false"}
                    aria-describedby={errorMessage ? "sign-in-error" : undefined}
                    style={{
                      width: "100%",
                      padding: "var(--space-3)",
                      borderRadius: "var(--radius-3)",
                      border: errorMessage
                        ? "1px solid var(--red-8)"
                        : "1px solid var(--gray-a5)",
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text)",
                      fontSize: "var(--font-size-3)"
                    }}
                  />
                </Box>
              </Flex>
            </label>
          <Text size="2" color="gray">
            {t("redirect", { destination: destinationLabel })}
          </Text>
          <Flex direction="column" gap="2" aria-live="polite">
            {status === "success" ? (
              <Callout.Root color="green" highContrast>
                <Callout.Text>{t("success")}</Callout.Text>
              </Callout.Root>
            ) : null}
            {errorMessage ? (
              <Callout.Root id="sign-in-error" color="tomato" highContrast>
                <Callout.Text>{errorMessage}</Callout.Text>
              </Callout.Root>
            ) : null}
          </Flex>
          <Button type="submit" size="3" disabled={status === "loading" || status === "success"}>
            {status === "loading" ? t("submitting") : t("submit")}
          </Button>
        </Flex>
      </form>
    </Flex>
  );
}
