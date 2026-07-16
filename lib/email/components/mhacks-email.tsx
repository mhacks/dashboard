import * as React from "react";
import {
  Button,
  Column,
  Heading,
  Hr,
  Img,
  Link,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { emailAssets, emailSocialLinks } from "@/lib/email/assets";
import { defaultEmailTheme } from "@/lib/email/theme";
import type { EmailThemeTokens } from "@/lib/email/types";

export function EmailHeader({
  eyebrow,
  heading,
  theme = defaultEmailTheme,
}: {
  eyebrow?: string;
  heading: string;
  theme?: EmailThemeTokens;
}) {
  return (
    <Section>
      <Img
        alt="MHacks"
        height="80"
        src={emailAssets.logoBadge}
        style={logo}
        width="80"
      />
      {eyebrow ? <Text style={eyebrowStyle(theme)}>{eyebrow}</Text> : null}
      <Heading as="h1" style={headingStyle(theme)}>
        {heading}
      </Heading>
    </Section>
  );
}

export function EmailSection({
  title,
  body,
  kind = "text",
  theme = defaultEmailTheme,
}: {
  title?: string;
  body: string;
  kind?: "text" | "code";
  theme?: EmailThemeTokens;
}) {
  return (
    <Section style={sectionBlock}>
      {title ? (
        <Heading as="h2" style={sectionHeadingStyle(theme)}>
          {title}
        </Heading>
      ) : null}
      {kind === "code" ? (
        <Text style={codeBlock(theme)}>{body}</Text>
      ) : (
        body.split("\n").map((line, index) => (
          <Text key={`${line}-${index}`} style={paragraphStyle(theme)}>
            {renderInlineText(line)}
          </Text>
        ))
      )}
    </Section>
  );
}

function renderInlineText(value: string) {
  const parts = value.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${part}-${index}`} style={strongStyle}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    return part;
  });
}

export function EmailDivider({
  theme: _theme = defaultEmailTheme,
}: {
  theme?: EmailThemeTokens;
}) {
  void _theme;
  return (
    <Section style={flowerDividerWrap}>
      <Img
        alt=""
        src={emailAssets.flowerDivider}
        style={flowerDivider}
        width="100%"
      />
    </Section>
  );
}

export function EmailCta({
  label,
  url,
  theme = defaultEmailTheme,
}: {
  label: string;
  url: string;
  theme?: EmailThemeTokens;
}) {
  return (
    <Section style={ctaWrap}>
      <Button href={url} style={ctaButton(theme)}>
        {label}
      </Button>
    </Section>
  );
}

export function EmailFooter({
  note,
  theme = defaultEmailTheme,
}: {
  note?: string;
  theme?: EmailThemeTokens;
}) {
  return (
    <Section>
      {note ? <Text style={smallStyle(theme)}>{note}</Text> : null}
      <Hr style={footerRule} />
      <Row style={footerRow}>
        <Column style={footerColumn}>
          <Text style={websiteWrap}>
            MHacks,{" "}
            <Link href={emailSocialLinks.website} style={websiteLink(theme)}>
              www.mhacks.org
            </Link>
          </Text>
        </Column>
        <Column style={socialColumn}>
          <Row style={socialIconsRow}>
            <Column style={socialIconColumn}>
              <Link href={emailSocialLinks.linkedin} style={socialLink}>
                <Img
                  alt="LinkedIn"
                  height="32"
                  src={emailAssets.socials.linkedin}
                  style={socialIcon}
                  width="32"
                />
              </Link>
            </Column>
            <Column style={socialIconColumn}>
              <Link href={emailSocialLinks.x} style={socialLink}>
                <Img
                  alt="X"
                  height="32"
                  src={emailAssets.socials.x}
                  style={socialIcon}
                  width="32"
                />
              </Link>
            </Column>
            <Column style={socialIconColumn}>
              <Link href={emailSocialLinks.instagram} style={socialLink}>
                <Img
                  alt="Instagram"
                  height="32"
                  src={emailAssets.socials.instagram}
                  style={socialIcon}
                  width="32"
                />
              </Link>
            </Column>
            <Column style={socialIconColumn}>
              <Link href={emailSocialLinks.youtube} style={socialLink}>
                <Img
                  alt="YouTube"
                  height="32"
                  src={emailAssets.socials.youtube}
                  style={socialIcon}
                  width="32"
                />
              </Link>
            </Column>
          </Row>
        </Column>
      </Row>
    </Section>
  );
}

const paragraphStyle = (theme: EmailThemeTokens) => ({
  color: theme.text,
  fontSize: theme.bodySize,
  fontWeight: "400",
  lineHeight: "24px",
  margin: "24px 0",
});

const strongStyle = {
  color: "#050505",
  fontWeight: "700",
};

const smallStyle = (theme: EmailThemeTokens) => ({
  color: theme.muted,
  fontSize: "16px",
  fontWeight: "400",
  lineHeight: "24px",
  margin: "24px 0",
});

const headingStyle = (theme: EmailThemeTokens) => ({
  color: "#050505",
  fontFamily: theme.fontFamily,
  fontSize: theme.headingSize,
  lineHeight: "30px",
  fontWeight: "700",
  margin: "8px 0 24px",
  textTransform: "uppercase" as const,
});

const sectionHeadingStyle = (theme: EmailThemeTokens) => ({
  color: "#050505",
  fontFamily: theme.fontFamily,
  fontSize: "20px",
  lineHeight: "30px",
  fontWeight: "700",
  margin: "0",
});

const logo = {
  display: "block",
  margin: "0 0 32px",
};

const eyebrowStyle = (theme: EmailThemeTokens) => ({
  color: theme.green,
  fontFamily: theme.fontFamily,
  fontSize: "16px",
  fontWeight: "700",
  letterSpacing: "0",
  lineHeight: "24px",
  margin: "16px 0 0",
  textTransform: "uppercase" as const,
});

const sectionBlock = {
  margin: "24px 0",
};

const codeBlock = (theme: EmailThemeTokens) => ({
  backgroundColor: theme.panel,
  border: `1px solid ${theme.border}`,
  borderRadius: "8px",
  color: "#050505",
  fontFamily: theme.fontFamily,
  fontSize: "32px",
  fontWeight: "700",
  letterSpacing: "8px",
  lineHeight: "40px",
  margin: "16px 0 24px",
  padding: "18px 12px",
  textAlign: "center" as const,
});

const ctaWrap = {
  margin: "32px 0",
  textAlign: "center" as const,
};

const ctaButton = (theme: EmailThemeTokens) => ({
  backgroundColor: theme.ctaBackground,
  borderRadius: theme.ctaRadius,
  color: theme.ctaColor,
  display: "block",
  fontSize: "20px",
  fontWeight: "700",
  lineHeight: "30px",
  padding: "20px 0",
  textDecoration: "none",
  textTransform: "uppercase" as const,
  width: "100%",
});

const flowerDividerWrap = {
  margin: "32px 0",
  textAlign: "center" as const,
};

const flowerDivider = {
  display: "block",
  margin: "0 auto",
  width: "100%",
};

const footerRule = {
  borderColor: "#050505",
  borderWidth: "1px",
  margin: "32px 0",
};

const socialLink = {
  display: "inline-block",
  height: "32px",
  lineHeight: "32px",
  margin: "0",
  textDecoration: "none",
  width: "32px",
};

const socialIcon = {
  border: "0",
  display: "block",
  height: "32px",
  outline: "none",
  verticalAlign: "middle",
  width: "32px",
};

const websiteWrap = {
  color: "#505050",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0",
  textAlign: "left" as const,
};

const websiteLink = (theme: EmailThemeTokens) => ({
  color: theme.green,
  fontSize: "12px",
  fontWeight: "700",
  textDecoration: "underline",
});

const footerRow = {
  width: "100%",
};

const footerColumn = {
  textAlign: "left" as const,
  verticalAlign: "middle" as const,
  width: "55%",
};

const socialColumn = {
  textAlign: "right" as const,
  verticalAlign: "middle" as const,
  width: "45%",
};

const socialIconsRow = {
  margin: "0 0 0 auto",
  width: "160px",
};

const socialIconColumn = {
  height: "32px",
  textAlign: "right" as const,
  verticalAlign: "middle" as const,
  width: "40px",
};
