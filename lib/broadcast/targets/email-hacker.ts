import { count, eq } from "drizzle-orm";
import { sendEmail } from "@/lib/aws/ses";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/users";
import { escapeHtml, renderHtmlEmail } from "@/lib/email/render";
import type {
  BroadcastDeliveryResult,
  BroadcastMessage,
  BroadcastRenderedMessage,
  BroadcastTarget,
} from "@/lib/broadcast/types";

export const hackerEmailTarget: BroadcastTarget = {
  id: "email:hacker",
  label: "Hacker Emails",
  description: "Send an email to every user with the hacker role.",
  countRecipients,
  resolveRecipients,
  renderMessage,
  deliver,
};

async function countRecipients() {
  const [{ value }] = await db
    .select({ value: count() })
    .from(users)
    .where(eq(users.role, "hacker"));

  return value;
}

async function resolveRecipients() {
  const emailRows = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.role, "hacker"));

  return emailRows
    .map((row) => row.email.trim().toLowerCase())
    .filter((email) => email.length > 0);
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
      recipient,
      status: "sent",
      error: null,
    };
  } catch (error) {
    return {
      recipient,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown email error",
    };
  }
}
