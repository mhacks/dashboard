import { sendEmail } from "@/lib/aws/ses";
import { prepareOptionalEmailDelivery } from "@/lib/email/preferences";
import { renderCampaignEmail, renderHtmlEmail } from "@/lib/email/render";
import { defaultEmailTheme } from "@/lib/email/theme";
import type {
  DirectEmailTemplateInput,
  EmailCampaignContent,
  EmailDeliveryType,
  EmailTemplateType,
  EmailThemeTokens,
} from "@/lib/email/types";

type SendStatus = "sent" | "failed" | "suppressed";
type EmailRecipientMergeData = Record<string, string>;

export type EmailTemplateSnapshot = {
  name: string;
  type: EmailTemplateType;
  subject: string;
  previewText: string;
  content: EmailCampaignContent | null;
  html: string | null;
  sourceTemplateId: string;
};

export interface SendResult {
  email: string;
  status: SendStatus;
  messageId: string | null;
  error: string | null;
}

export function snapshotFromDirectTemplate(
  template: DirectEmailTemplateInput,
): EmailTemplateSnapshot {
  return template.type === "html"
    ? {
        name: template.subject,
        type: "html",
        subject: template.subject,
        previewText: template.previewText,
        content: null,
        html: template.html,
        sourceTemplateId: "mhacks-announcement",
      }
    : {
        name: template.subject,
        type: "structured",
        subject: template.subject,
        previewText: template.previewText,
        content: template.content,
        html: null,
        sourceTemplateId: template.templateId,
      };
}

export async function sendSnapshotToEmail(
  campaign: {
    templateSnapshot: EmailTemplateSnapshot;
    themeSnapshot: EmailThemeTokens | null;
  },
  email: string,
  mergeData: EmailRecipientMergeData,
  deliveryType: EmailDeliveryType = "transactional",
): Promise<SendResult> {
  try {
    const preference =
      deliveryType === "subscription"
        ? await prepareOptionalEmailDelivery(email)
        : null;

    if (preference?.suppressed) {
      return {
        email,
        status: "suppressed",
        messageId: null,
        error: "Recipient unsubscribed from optional MHacks email.",
      };
    }

    const rendered = await renderSnapshot(
      campaign.templateSnapshot,
      campaign.themeSnapshot ?? defaultEmailTheme,
      mergeData,
      preference?.footerUrl,
    );
    const messageId = await sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      deliveryType,
      unsubscribeUrl: preference?.oneClickUrl,
    });

    return { email, status: "sent", messageId, error: null };
  } catch (error) {
    return {
      email,
      status: "failed",
      messageId: null,
      error: sanitizeEmailError(error),
    };
  }
}

function sanitizeEmailError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown email error";
}

async function renderSnapshot(
  snapshot: EmailTemplateSnapshot,
  theme: EmailThemeTokens,
  mergeData: EmailRecipientMergeData,
  unsubscribeUrl?: string,
) {
  if (snapshot.type === "html") {
    return renderHtmlEmail({
      subject: snapshot.subject,
      previewText: snapshot.previewText,
      html: snapshot.html ?? "",
      mergeData,
      unsubscribeUrl,
    });
  }

  return renderCampaignEmail({
    templateId: snapshot.sourceTemplateId,
    subject: snapshot.subject,
    previewText: snapshot.previewText,
    content: snapshot.content,
    theme,
    mergeData,
    unsubscribeUrl,
  });
}
