import { sendEmail } from "@/lib/aws/ses";
import { broadcastErrorMessage } from "@/lib/broadcast/config";
import { requiredEmailCampaignTestRecipients } from "@/lib/email/campaigns/constants";
import { escapeHtml, renderHtmlEmail } from "@/lib/email/render";
import type {
  BroadcastDeliveryResult,
  BroadcastMessage,
  BroadcastRenderedMessage,
  BroadcastTarget,
} from "@/lib/broadcast/types";

const testRecipientEmails = requiredEmailCampaignTestRecipients.map(
  (recipient) => recipient.email.trim().toLowerCase(),
);

export const organizerTestEmailTarget: BroadcastTarget = {
  id: "email:organizer-test",
  label: "Organizer Test Emails",
  countRecipients,
  resolveRecipients,
  renderMessage,
  deliver,
};

async function countRecipients() {
  return testRecipientEmails.length;
}

async function resolveRecipients() {
  return [...testRecipientEmails];
}

function renderMessage(message: BroadcastMessage): BroadcastRenderedMessage {
  const rendered = renderHtmlEmail({
    subject: message.subject,
    previewText: "",
    html: message.body
      .split("\n")
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join(""),
  });

  return {
    subject: rendered.subject,
    html: rendered.html,
    text: message.body,
  };
}

async function deliver(
  message: BroadcastRenderedMessage,
  recipient: string,
): Promise<BroadcastDeliveryResult> {
  try {
    await sendEmail({
      to: recipient,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    return {
      status: "sent",
      error: null,
    };
  } catch (error) {
    return {
      status: "failed",
      error: broadcastErrorMessage(error, "Unknown email error"),
    };
  }
}
