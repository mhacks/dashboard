import * as React from "react";
import {
  CampaignTemplate,
  type CampaignEmailVariant,
} from "@/lib/email/templates/campaign-template";
import type { EmailCampaignContent, EmailThemeTokens } from "@/lib/email/types";

export interface EmailTemplateDefinition {
  id: string;
  name: string;
  description: string;
  defaultSubject: string;
  defaultPreviewText: string;
  defaultContent: EmailCampaignContent;
  variant: CampaignEmailVariant;
  render: (input: {
    content: EmailCampaignContent;
    previewText: string;
    theme?: EmailThemeTokens;
  }) => React.ReactElement;
}

function template(
  definition: Omit<EmailTemplateDefinition, "render">,
): EmailTemplateDefinition {
  return {
    ...definition,
    render({ content, previewText, theme }) {
      return (
        <CampaignTemplate
          content={content}
          previewText={previewText}
          theme={theme}
          variant={definition.variant}
        />
      );
    },
  };
}

export const emailTemplates = [
  template({
    id: "mhacks-announcement",
    name: "MHacks announcement",
    description: "General event updates, reminders, and newsletters.",
    defaultSubject: "An update from MHacks",
    defaultPreviewText: "A quick update from the MHacks team.",
    variant: "general",
    defaultContent: {
      eyebrow: "MHacks Update",
      heading: "A quick MHacks update",
      intro: "Hi there,",
      sections: [
        {
          id: "main",
          title: "What to know",
          body: "We wanted to share an important update with you. Add the main campaign details here.",
        },
      ],
      cta: {
        label: "Learn more",
        url: "https://mhacks.org",
      },
      footerNote:
        "Questions? Reply to this email or reach out to the MHacks team.",
    },
  }),
  template({
    id: "mhacks-action-required",
    name: "Confirm your email",
    description:
      "Account confirmations, RSVP steps, and required portal actions.",
    defaultSubject: "Confirm your email",
    defaultPreviewText: "Activate your MHacks portal account.",
    variant: "action",
    defaultContent: {
      eyebrow: "Action Required",
      heading: "Confirm your email",
      intro:
        "Welcome to the MHacks portal! Thanks for creating an account with us.\n\nTo activate your account and start using the portal, please confirm your email address by clicking the button below.",
      sections: [
        {
          id: "next",
          title: "What's Next?",
          body: "Once you've confirmed your email, you'll be able to:\n\n- Access your MHacks portal dashboard\n- Apply for upcoming hackathons\n- Manage your profile and applications\n- Receive important updates about MHacks events",
        },
        {
          id: "stay-connected",
          title: "Stay Connected",
          body: "Follow us on social media for the latest MHacks updates and announcements!\n\nQuestions? Reach out to us anytime at hackathon@mhacks.org\n\nWe're excited to have you join the MHacks community!\n\n- MHacks Team",
        },
      ],
      cta: {
        label: "Confirm email",
        url: "https://mhacks.org",
      },
      footerNote: "",
    },
  }),
  template({
    id: "mhacks-travel",
    name: "Travel reimbursement",
    description:
      "Travel and reimbursement notices with recipient merge fields.",
    defaultSubject: "MHacks travel reimbursement information",
    defaultPreviewText: "Important MHacks travel reimbursement details.",
    variant: "travel",
    defaultContent: {
      eyebrow: "Travel",
      heading: "Travel reimbursement information",
      intro: "Hi {{name}},",
      sections: [
        {
          id: "offer",
          title: "Reimbursement details",
          body: "We are able to offer a travel reimbursement of ${{travel_reimbursement}} for MHacks. Please keep your receipts and review the details below.",
        },
        {
          id: "requirements",
          title: "Requirements",
          body: "You must attend MHacks in person, submit a completed project, and submit eligible receipts through the reimbursement process.",
        },
      ],
      cta: {
        label: "View travel details",
        url: "https://mhacks.org",
      },
      footerNote:
        "Reimbursement details are subject to verification by the MHacks team.",
    },
  }),
  template({
    id: "mhacks-password-otp",
    name: "Password OTP",
    description: "One-time password and account recovery verification codes.",
    defaultSubject: "Your MHacks verification code",
    defaultPreviewText: "Use this code to finish resetting your password.",
    variant: "action",
    defaultContent: {
      eyebrow: "Verification Code",
      heading: "Your password reset code",
      intro:
        "Hi {{name}},\n\nUse this one-time code to finish resetting your MHacks password.",
      sections: [
        {
          id: "otp-code",
          kind: "code",
          title: "Your code",
          body: "{{otp_code}}",
        },
        {
          id: "security-note",
          title: "Security note",
          body: "This code expires in {{expires_in}}. If you didn't request a password reset, you can safely ignore this email.",
        },
      ],
      footerNote:
        "Questions? Reply to this email or reach out to the MHacks team.",
    },
  }),
] satisfies EmailTemplateDefinition[];

export function getEmailTemplate(templateId: string) {
  return emailTemplates.find((template) => template.id === templateId) ?? null;
}

export function getTemplateCatalog() {
  return emailTemplates.map(
    ({
      id,
      name,
      description,
      defaultSubject,
      defaultPreviewText,
      defaultContent,
    }) => ({
      id,
      name,
      description,
      defaultSubject,
      defaultPreviewText,
      defaultContent,
    }),
  );
}
