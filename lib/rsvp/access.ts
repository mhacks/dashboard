import { eq } from "drizzle-orm";

import { decisionOutcome, type ApplicationDecision } from "@/lib/decisions";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { hackerRsvps } from "@/lib/db/schema/rsvps";
import { assertRsvpOpen } from "@/lib/rsvp/deadline";

export type RsvpTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export function assertAcceptedRsvpDecision(
  decision: ApplicationDecision,
): void {
  if (decisionOutcome(decision) !== "accepted") {
    throw new Error("An accepted MHacks 2026 application is required to RSVP");
  }
}

export async function lockWritableRsvpApplicant(
  tx: RsvpTransaction,
  userId: string,
): Promise<{
  id: string;
  userId: string;
  decision: ApplicationDecision;
  transportationType: string;
  comingFrom: string;
  needsTravelReimbursement: boolean;
}> {
  assertRsvpOpen();

  const [application] = await tx
    .select({
      id: hackerApplicants.id,
      userId: hackerApplicants.userId,
      decision: hackerApplicants.decision,
      transportationType: hackerApplicants.transportationType,
      comingFrom: hackerApplicants.comingFrom,
      needsTravelReimbursement: hackerApplicants.needsTravelReimbursement,
    })
    .from(hackerApplicants)
    .where(eq(hackerApplicants.userId, userId))
    .for("update");

  if (!application) {
    throw new Error("A submitted MHacks 2026 application is required");
  }
  assertAcceptedRsvpDecision(application.decision);

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
