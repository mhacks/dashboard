import { and, count, eq, sql } from "drizzle-orm";
import {
  deliverBroadcastEmail,
  renderBroadcastEmail,
} from "@/lib/broadcast/targets/email-shared";
import type { BroadcastTarget } from "@/lib/broadcast/types";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/users";

const hackerRecipientFilter = and(
  eq(users.role, "hacker"),
  sql`length(btrim(${users.email})) > 0`,
);

export const hackerEmailTarget: BroadcastTarget = {
  id: "email:hacker",
  label: "Hacker Emails",
  countRecipients,
  resolveRecipients,
  renderMessage: renderBroadcastEmail,
  deliver: deliverBroadcastEmail,
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
