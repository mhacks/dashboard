import { and, eq } from "drizzle-orm";

import { decisionOutcome, type ApplicationDecision } from "@/lib/decisions";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import {
  hackerReimbursements,
  reimbursementRegions,
} from "@/lib/db/schema/reimbursements";
import { hackerRsvps } from "@/lib/db/schema/rsvps";
import { assertRsvpOpen } from "@/lib/rsvp/deadline";
import { EVENT } from "@/lib/config/event";
import {
  hasApprovedTravelAward,
  type RsvpTravelEligibilitySource,
} from "@/lib/rsvp/travel-eligibility";

export type RsvpTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export function assertAcceptedRsvpDecision(
  decision: ApplicationDecision,
): void {
  if (decisionOutcome(decision) !== "accepted") {
    throw new Error(
      `An accepted ${EVENT.fullName} application is required to RSVP`,
    );
  }
}

export async function lockWritableRsvpApplicant(
  tx: RsvpTransaction,
  userId: string,
): Promise<RsvpTravelEligibilitySource> {
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
    throw new Error(`A submitted ${EVENT.fullName} application is required`);
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

  const [award] = await tx
    .select({ amountCents: reimbursementRegions.amountCents })
    .from(hackerReimbursements)
    .innerJoin(
      reimbursementRegions,
      eq(reimbursementRegions.region, hackerReimbursements.region),
    )
    .where(
      and(
        eq(hackerReimbursements.userId, userId),
        eq(hackerReimbursements.status, "approved"),
      ),
    )
    .limit(1);

  assertRsvpOpen();
  return {
    transportationType: application.transportationType,
    comingFrom: application.comingFrom,
    needsTravelReimbursement: application.needsTravelReimbursement,
    hasTravelAward: hasApprovedTravelAward(award?.amountCents),
  };
}
