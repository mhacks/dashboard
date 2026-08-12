import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { hackerRsvps } from "@/lib/db/schema/rsvps";
import { assertRsvpOpen } from "@/lib/rsvp/deadline";

export type RsvpTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export async function lockWritableRsvpApplicant(
  tx: RsvpTransaction,
  userId: string,
): Promise<{ id: string; userId: string }> {
  assertRsvpOpen();

  const [application] = await tx
    .select({
      id: hackerApplicants.id,
      userId: hackerApplicants.userId,
    })
    .from(hackerApplicants)
    .where(eq(hackerApplicants.userId, userId))
    .for("update");

  if (!application) {
    throw new Error("A submitted MHacks 2026 application is required");
  }

  const [existingRsvp] = await tx
    .select({ id: hackerRsvps.id })
    .from(hackerRsvps)
    .where(eq(hackerRsvps.userId, userId))
    .limit(1);

  if (existingRsvp) {
    throw new Error("Your RSVP has already been submitted");
  }

  assertRsvpOpen();
  return application;
}
