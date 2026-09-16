import { sendEmail } from "@/lib/aws/ses";
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
    const messageId = await sendWithThrottleRetry({
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
      error: sanitizeEmailError(error),
    };
  }
}

const maxThrottleRetries = 4;

/**
 * SES rejects requests above the account send rate with a throttling error.
 * Concurrent workers can briefly exceed it, so back off and retry instead of
 * recording the recipient as a permanent failure.
 */
async function sendWithThrottleRetry(input: Parameters<typeof sendEmail>[0]) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await sendEmail(input);
    } catch (error) {
      if (attempt >= maxThrottleRetries || !isThrottleError(error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
}

function isThrottleError(error: unknown) {
  const cause =
    error instanceof Error && error.cause !== undefined ? error.cause : error;
  if (!cause || typeof cause !== "object") return false;
  const name = "name" in cause ? String(cause.name) : "";
  const code = "code" in cause ? String(cause.code) : "";
  const httpStatus =
    "$metadata" in cause &&
    cause.$metadata &&
    typeof cause.$metadata === "object" &&
    "httpStatusCode" in cause.$metadata
      ? cause.$metadata.httpStatusCode
      : undefined;

  return (
    httpStatus === 429 ||
    /Throttl|TooManyRequests|LimitExceeded/i.test(name) ||
    /Throttl|TooManyRequests|LimitExceeded/i.test(code)
  );
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
