import { and, count, eq, sql } from "drizzle-orm";
import { sendEmail } from "@/lib/aws/ses";
import { broadcastErrorMessage } from "@/lib/broadcast/config";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/users";
import { escapeHtml, renderHtmlEmail } from "@/lib/email/render";
import type {
  BroadcastDeliveryResult,
  BroadcastMessage,
  BroadcastRenderedMessage,
  BroadcastTarget,
} from "@/lib/broadcast/types";

const hackerRecipientFilter = and(
  eq(users.role, "hacker"),
  sql`length(btrim(${users.email})) > 0`,
);

export const hackerEmailTarget: BroadcastTarget = {
  id: "email:hacker",
  label: "Hacker Emails",
  countRecipients,
  resolveRecipients,
  renderMessage,
  deliver,
};

async function countRecipients() {
  const [{ value }] = await db
    .select({ value: count() })
    .from(users)
    .where(hackerRecipientFilter);

  return value;
}

async function resolveRecipients() {
  const emailRows = await db
    .select({ email: users.email })
    .from(users)
    .where(hackerRecipientFilter);

  return emailRows.map((row) => row.email.trim().toLowerCase());
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
