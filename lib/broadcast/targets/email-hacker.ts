import { count, eq } from "drizzle-orm";
import { sendEmail } from "@/lib/aws/ses";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/users";
import { renderHtmlEmail } from "@/lib/email/render";
import type {
  BroadcastDeliveryResult,
  BroadcastMessage,
  BroadcastTarget,
} from "@/lib/broadcast/types";

export const hackerEmailTarget: BroadcastTarget = {
  id: "email:hacker",
  label: "Hacker Emails",
  description: "Send an email to every user with the hacker role.",
  countRecipients,
  resolveRecipients,
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

async function deliver(
  message: BroadcastMessage,
  recipient: string,
): Promise<BroadcastDeliveryResult> {
  try {
    const rendered = renderHtmlEmail({
      subject: message.subject,
      previewText: "",
      html: message.body
        .split("\n")
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join(""),
    });

    const messageId = await sendEmail({
      to: recipient,
      subject: rendered.subject,
      text: message.body,
      html: rendered.html,
    });

    return {
      recipient,
      status: "sent",
      reference: messageId,
      error: null,
    };
  } catch (error) {
    return {
      recipient,
      status: "failed",
      reference: null,
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
