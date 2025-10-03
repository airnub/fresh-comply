"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Button, Flex, Grid, Text, TextArea, TextField } from "@radix-ui/themes";
import type { TenantBrandingPayload } from "../../../lib/tenant-branding";
import type { DocumentBrandingMetadata } from "@airnub/doc-templates/index";

type FormCopy = {
  labels: {
    logoUrl: string;
    faviconUrl: string;
    primaryColor: string;
    accentColor: string;
    footerText: string;
    headerText: string;
    bodyFont: string;
    headingFont: string;
    pdfFooterText: string;
  };
  actions: {
    submit: string;
    saving: string;
  };
  messages: {
    success: string;
    error: string;
  };
};

function extractColor(vars: Record<string, string>, key: string, fallback: string) {
  return vars[key] ?? fallback;
}

export default function TenantBrandingForm({
  initialBranding,
  documentBranding,
  locale,
  copy
}: {
  initialBranding: TenantBrandingPayload;
  documentBranding: DocumentBrandingMetadata;
  locale: string;
  copy: FormCopy;
}) {
  const formId = useId();
  const cssVars = initialBranding.tokens.cssVariables ?? {};
  const [logoUrl, setLogoUrl] = useState(initialBranding.logoUrl ?? "");
  const [faviconUrl, setFaviconUrl] = useState(initialBranding.faviconUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(extractColor(cssVars, "--brand-primary", "#0D47A1"));
  const [accentColor, setAccentColor] = useState(extractColor(cssVars, "--brand-accent", "#00B8A9"));
  const [headerText, setHeaderText] = useState(
    (initialBranding.pdfHeader?.text as string | undefined) ?? ""
  );
  const [footerText, setFooterText] = useState(
    (initialBranding.pdfFooter?.text as string | undefined) ?? ""
  );
  const [pdfFooterText, setPdfFooterText] = useState(
    (initialBranding.pdfFooter?.disclaimer as string | undefined) ?? ""
  );
  const [bodyFont, setBodyFont] = useState(initialBranding.typography?.bodyFont ?? "Inter");
  const [headingFont, setHeadingFont] = useState(initialBranding.typography?.headingFont ?? "Inter");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const buildBrandingPayload = (): DocumentBrandingMetadata => ({
    header: {
      text: headerText || documentBranding.header?.text,
      logoUrl: logoUrl || documentBranding.header?.logoUrl ?? undefined,
      accentColor: primaryColor
    },
    footer: {
      text: footerText || documentBranding.footer?.text,
      accentColor: accentColor,
      disclaimer: pdfFooterText || undefined
    },
    typography: {
      bodyFont,
      headingFont
    },
    palette: {
      ...(documentBranding.palette ?? {}),
      primary: primaryColor,
      accent: accentColor
    }
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const payload = buildBrandingPayload();

    startTransition(async () => {
      const response = await fetch("/api/partner-admin/branding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tokens: {
            themeId: initialBranding.tokens.themeId ?? `tenant-${locale}`,
            mode: initialBranding.tokens.mode ?? "light",
            cssVariables: {
              ...cssVars,
              "--brand-primary": primaryColor,
              "--brand-accent": accentColor
            },
            palette: {
              ...(documentBranding.palette ?? {}),
              primary: primaryColor,
              accent: accentColor
            }
          },
          logoUrl: logoUrl || null,
          faviconUrl: faviconUrl || null,
          typography: {
            bodyFont,
            headingFont
          },
          pdfHeader: {
            text: headerText || null,
            logoUrl: logoUrl || null
          },
          pdfFooter: {
            text: footerText || null,
            disclaimer: pdfFooterText || null,
            accentColor
          }
        })
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as { error?: string };
        setMessage({ type: "error", text: errorBody.error ?? copy.messages.error });
        return;
      }

      setMessage({ type: "success", text: copy.messages.success });
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Flex direction="column" gap="4">
        <Grid columns={{ initial: "1", md: "2" }} gap="4">
          <Flex direction="column" gap="1">
            <Text as="label" size="2" color="gray" htmlFor={`${formId}-logo`}>
              {copy.labels.logoUrl}
            </Text>
            <TextField.Root
              id={`${formId}-logo`}
              type="url"
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </Flex>
          <Flex direction="column" gap="1">
            <Text as="label" size="2" color="gray" htmlFor={`${formId}-favicon`}>
              {copy.labels.faviconUrl}
            </Text>
            <TextField.Root
              id={`${formId}-favicon`}
              type="url"
              value={faviconUrl}
              onChange={(event) => setFaviconUrl(event.target.value)}
              placeholder="https://example.com/favicon.ico"
            />
          </Flex>
          <Flex direction="column" gap="1">
            <Text as="label" size="2" color="gray" htmlFor={`${formId}-primary`}>
              {copy.labels.primaryColor}
            </Text>
            <TextField.Root
              id={`${formId}-primary`}
              type="text"
              value={primaryColor}
              onChange={(event) => setPrimaryColor(event.target.value)}
            />
          </Flex>
          <Flex direction="column" gap="1">
            <Text as="label" size="2" color="gray" htmlFor={`${formId}-accent`}>
              {copy.labels.accentColor}
            </Text>
            <TextField.Root
              id={`${formId}-accent`}
              type="text"
              value={accentColor}
              onChange={(event) => setAccentColor(event.target.value)}
            />
          </Flex>
          <Flex direction="column" gap="1">
            <Text as="label" size="2" color="gray" htmlFor={`${formId}-body-font`}>
              {copy.labels.bodyFont}
            </Text>
            <TextField.Root
              id={`${formId}-body-font`}
              type="text"
              value={bodyFont}
              onChange={(event) => setBodyFont(event.target.value)}
            />
          </Flex>
          <Flex direction="column" gap="1">
            <Text as="label" size="2" color="gray" htmlFor={`${formId}-heading-font`}>
              {copy.labels.headingFont}
            </Text>
            <TextField.Root
              id={`${formId}-heading-font`}
              type="text"
              value={headingFont}
              onChange={(event) => setHeadingFont(event.target.value)}
            />
          </Flex>
        </Grid>
        <Flex direction="column" gap="1">
          <Text as="label" size="2" color="gray" htmlFor={`${formId}-header-text`}>
            {copy.labels.headerText}
          </Text>
          <TextField.Root
            id={`${formId}-header-text`}
            type="text"
            value={headerText}
            onChange={(event) => setHeaderText(event.target.value)}
          />
        </Flex>
        <Flex direction="column" gap="1">
          <Text as="label" size="2" color="gray" htmlFor={`${formId}-footer-text`}>
            {copy.labels.footerText}
          </Text>
          <TextField.Root
            id={`${formId}-footer-text`}
            type="text"
            value={footerText}
            onChange={(event) => setFooterText(event.target.value)}
          />
        </Flex>
        <Flex direction="column" gap="1">
          <Text as="label" size="2" color="gray" htmlFor={`${formId}-pdf-footer`}>
            {copy.labels.pdfFooterText}
          </Text>
          <TextArea
            id={`${formId}-pdf-footer`}
            value={pdfFooterText}
            onChange={(event) => setPdfFooterText(event.target.value)}
            rows={3}
          />
        </Flex>
        <Flex gap="3">
          <Button type="submit" disabled={isPending}>
            {isPending ? copy.actions.saving : copy.actions.submit}
          </Button>
        </Flex>
        {message ? (
          <Text as="p" color={message.type === "success" ? "green" : "red"}>
            {message.text}
          </Text>
        ) : null}
      </Flex>
    </form>
  );
}
