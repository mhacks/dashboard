"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/users";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { broadcastLogs } from "@/lib/db/schema/broadcasts";
import { getSessionUser } from "@/lib/auth/session";
import { sendBulkEmail } from "@/lib/aws/ses.placeholder";
import { sendBulkSMS } from "@/lib/aws/sms.placeholder";

export async function broadcastAll(formData: FormData) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== "organizer") {
    throw new Error("Unauthorized");
  }

  const subject = formData.get("subject") as string;
  const body = formData.get("body") as string;

  const emailRows = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.role, "hacker"));
  const smsRows = await db
    .select({ phoneNumber: hackerApplicants.phoneNumber })
    .from(hackerApplicants);

  const emails = emailRows.map((r) => r.email).filter((e) => e.length > 0);
  const phoneNumbers = smsRows
    .map((r) => r.phoneNumber)
    .filter((p) => p.length > 0);

  const [emailResults, smsResults] = await Promise.all([
    sendBulkEmail(emails, subject, body),
    sendBulkSMS(phoneNumbers, body),
  ]);

  await db.insert(broadcastLogs).values({
    subject,
    body,
    sentBy: sessionUser.id,
    broadcastedToEmail: emailResults.succeeded,
    broadcastedToText: smsResults.succeeded,
  });

  redirect("/broadcast_hackers/success");
}
