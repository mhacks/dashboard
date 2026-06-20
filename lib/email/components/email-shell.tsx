import * as React from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
} from "@react-email/components";
import { defaultEmailTheme } from "@/lib/email/theme";
import type { EmailThemeTokens } from "@/lib/email/types";

export function EmailShell({
  preview,
  theme = defaultEmailTheme,
  children,
}: {
  preview: string;
  theme?: EmailThemeTokens;
  children: React.ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body(theme)}>
        <Container style={container(theme)}>{children}</Container>
      </Body>
    </Html>
  );
}

export function EmailPanel({
  theme = defaultEmailTheme,
  children,
}: {
  theme?: EmailThemeTokens;
  children: React.ReactNode;
}) {
  return <Section style={panel(theme)}>{children}</Section>;
}

const body = (theme: EmailThemeTokens) => ({
  background: `linear-gradient(135deg, ${theme.background}, ${theme.backgroundAccent})`,
  backgroundColor: theme.background,
  fontFamily: theme.fontFamily,
  lineHeight: "24px",
  margin: "0",
  padding: "32px 12px",
});

const container = (theme: EmailThemeTokens) => ({
  backgroundColor: theme.white,
  border: `${theme.containerBorderWidth} solid ${theme.border}`,
  borderRadius: theme.containerRadius,
  boxSizing: "border-box" as const,
  margin: "0 auto",
  maxWidth: "600px",
  padding: theme.containerPadding,
  width: "100%",
});

const panel = (theme: EmailThemeTokens) => ({
  backgroundColor: theme.panel,
  border: "0",
  borderRadius: "4px",
  margin: "16px 0",
  padding: "8px",
});
