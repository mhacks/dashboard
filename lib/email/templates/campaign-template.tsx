import * as React from "react";
import { Text } from "@react-email/components";
import { EmailShell } from "@/lib/email/components/email-shell";
import {
  EmailCta,
  EmailDivider,
  EmailFooter,
  EmailHeader,
  EmailSection,
} from "@/lib/email/components/mhacks-email";
import { defaultEmailTheme } from "@/lib/email/theme";
import type { EmailCampaignContent, EmailThemeTokens } from "@/lib/email/types";

export type CampaignEmailVariant = "general" | "action" | "travel";

export function CampaignTemplate({
  content,
  previewText,
  theme = defaultEmailTheme,
  variant = "general",
}: {
  content: EmailCampaignContent;
  previewText: string;
  theme?: EmailThemeTokens;
  variant?: CampaignEmailVariant;
}) {
  void variant;
  const hasCta = Boolean(content.cta);
  const sections = content.sections.map((section) => (
    <EmailSection
      key={section.id}
      title={section.title}
      body={section.body}
      kind={section.kind}
      theme={theme}
    />
  ));

  return (
    <EmailShell preview={previewText} theme={theme}>
      <EmailHeader
        eyebrow={content.eyebrow}
        heading={content.heading}
        theme={theme}
      />

      {content.intro ? (
        <Text style={paragraphStyle(theme)}>{content.intro}</Text>
      ) : null}

      {content.cta ? (
        <EmailCta
          label={content.cta.label}
          url={content.cta.url}
          theme={theme}
        />
      ) : null}

      {hasCta ? (
        <>
          <EmailDivider theme={theme} />
          {sections}
        </>
      ) : (
        <>
          {sections}
          <EmailDivider theme={theme} />
        </>
      )}

      <EmailFooter note={content.footerNote} theme={theme} />
    </EmailShell>
  );
}

const paragraphStyle = (theme: EmailThemeTokens) => ({
  color: theme.text,
  fontSize: theme.bodySize,
  fontWeight: "500",
  lineHeight: "21px",
  margin: "14px 0 18px",
});
