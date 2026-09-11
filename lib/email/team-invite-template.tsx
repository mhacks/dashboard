import * as React from "react";
import {
  Body,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";
import { TEAM_NAME_MAX_LENGTH } from "@/lib/types/teams";

const fontFamily = '"Red Hat Display", Arial, sans-serif';

function TeamInviteEmail({
  teamName,
  inviterName,
  teamUrl,
}: {
  teamName: string;
  inviterName: string;
  teamUrl: string;
}) {
  const previewText = `${inviterName} invited you to join their MHacks team.`;

  return (
    <Html lang="en">
      <Head>
        {/* Email HTML, not a Next.js page — same font links as otp.html. */}
        {/* eslint-disable @next/next/no-page-custom-font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@400;700;800;900&display=swap"
          rel="stylesheet"
        />
        {/* eslint-enable @next/next/no-page-custom-font */}
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Section style={outerSection}>
          <Section style={card}>
            <Section style={logoSection}>
              <Img
                alt="MHacks"
                height="120"
                src="https://www.mhacks.org/mhacks_logo_green_bg.svg"
                style={logo}
                width="120"
              />
            </Section>

            <Section style={contentSection}>
              <Text style={eyebrow}>Team Invite</Text>
              <Heading as="h1" style={heading}>
                Join &quot;{teamName}&quot;
              </Heading>
              <Text style={paragraph}>
                <strong style={strong}>{inviterName}</strong> invited you to
                join their team on MHacks. Sign in to view and respond to the
                invitation.
              </Text>
            </Section>

            <Section style={ctaSection}>
              <Link href={teamUrl} style={button}>
                View invitation
              </Link>
              <Text style={linkFallback}>
                Or copy this link into your browser:
                <br />
                <Link href={teamUrl} style={fallbackLink}>
                  {teamUrl}
                </Link>
              </Text>
            </Section>

            <Section style={footerSection}>
              <Text style={paragraph}>
                Questions? Reach out to us anytime at{" "}
                <Link href="mailto:hackathon@mhacks.org" style={inlineLink}>
                  hackathon@mhacks.org
                </Link>
                .
              </Text>
              <Text style={signature}>&mdash; The MHacks Team</Text>
            </Section>
          </Section>
        </Section>
      </Body>
    </Html>
  );
}

export async function buildTeamInviteEmail({
  teamName,
  inviterName,
  teamUrl,
}: {
  teamName: string;
  inviterName: string;
  teamUrl: string;
}) {
  const boundedTeamName = teamName.slice(0, TEAM_NAME_MAX_LENGTH);
  const subject = `${inviterName} invited you to join their MHacks team`;

  const element = (
    <TeamInviteEmail
      teamName={boundedTeamName}
      inviterName={inviterName}
      teamUrl={teamUrl}
    />
  );

  const html = await render(element, { pretty: true });
  const text = await render(element, { plainText: true });

  return { subject, text, html };
}

const body = {
  backgroundColor: "#f6f1de",
  fontFamily,
  margin: "0",
  padding: "0",
  WebkitFontSmoothing: "antialiased" as const,
};

const outerSection = {
  backgroundColor: "#f6f1de",
  padding: "40px 0",
  width: "100%",
};

const card = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  margin: "0 auto",
  maxWidth: "600px",
  overflow: "hidden",
  width: "100%",
};

const logoSection = {
  padding: "40px 40px 20px",
  textAlign: "center" as const,
};

const logo = {
  display: "block",
  margin: "0 auto",
};

const contentSection = {
  fontFamily,
  padding: "0 40px",
};

const ctaSection = {
  fontFamily,
  padding: "0 40px 32px",
  textAlign: "center" as const,
};

const footerSection = {
  fontFamily,
  padding: "0 40px 40px",
};

const eyebrow = {
  color: "#69a13b",
  fontSize: "18px",
  fontWeight: "800",
  letterSpacing: "1px",
  margin: "0",
  textTransform: "uppercase" as const,
};

const heading = {
  color: "#040404",
  fontSize: "32px",
  fontWeight: "900",
  lineHeight: "1.2",
  margin: "16px 0 24px",
};

const paragraph = {
  color: "#505050",
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 32px",
};

const strong = {
  color: "#040404",
};

const button = {
  backgroundColor: "#3a4a26",
  borderRadius: "999px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: "700",
  lineHeight: "1",
  padding: "14px 28px",
  textDecoration: "none",
};

const linkFallback = {
  color: "#707070",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "16px 0 0",
};

const fallbackLink = {
  color: "#4285f4",
  textDecoration: "underline",
  wordBreak: "break-all" as const,
};

const inlineLink = {
  color: "#4285f4",
  textDecoration: "underline",
};

const signature = {
  color: "#505050",
  fontSize: "16px",
  fontWeight: "700",
  margin: "0",
};
