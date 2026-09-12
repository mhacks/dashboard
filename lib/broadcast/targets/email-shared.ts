import { sendEmail } from "@/lib/aws/ses";
import { broadcastErrorMessage } from "@/lib/broadcast/config";
import type {
  BroadcastDeliveryResult,
  BroadcastMessage,
  BroadcastRenderedMessage,
} from "@/lib/broadcast/types";
import { escapeHtml, renderHtmlEmail } from "@/lib/email/render";

export function renderBroadcastEmail(
  message: BroadcastMessage,
): BroadcastRenderedMessage {
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

export async function deliverBroadcastEmail(
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
