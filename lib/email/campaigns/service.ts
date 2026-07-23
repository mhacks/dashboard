import { sanitizeSesError, sendRenderedEmail } from "@/lib/email/campaigns/ses";
import { renderCampaignEmail, renderHtmlEmail } from "@/lib/email/render";
import { defaultEmailTheme } from "@/lib/email/theme";
import type {
  DirectEmailTemplateInput,
  EmailCampaignContent,
  EmailTemplateType,
  EmailThemeTokens,
} from "@/lib/email/types";

type SendStatus = "sent" | "failed";
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
): Promise<SendResult> {
  try {
    const rendered = await renderSnapshot(
      campaign.templateSnapshot,
      campaign.themeSnapshot ?? defaultEmailTheme,
      mergeData,
    );
    const messageId = await sendRenderedEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    return { email, status: "sent", messageId, error: null };
  } catch (error) {
    return {
      email,
      status: "failed",
      messageId: null,
      error: sanitizeSesError(error),
    };
  }
}

async function renderSnapshot(
  snapshot: EmailTemplateSnapshot,
  theme: EmailThemeTokens,
  mergeData: EmailRecipientMergeData,
) {
  if (snapshot.type === "html") {
    return renderHtmlEmail({
      subject: snapshot.subject,
      previewText: snapshot.previewText,
      html: snapshot.html ?? "",
      mergeData,
    });
  }

  return renderCampaignEmail({
    templateId: snapshot.sourceTemplateId,
    subject: snapshot.subject,
    previewText: snapshot.previewText,
    content: snapshot.content,
    theme,
    mergeData,
  });
}
