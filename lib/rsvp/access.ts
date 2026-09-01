import { and, desc, eq, gt, isNull } from "drizzle-orm";

import { decisionOutcome, type ApplicationDecision } from "@/lib/decisions";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import {
  hackerReimbursements,
  reimbursementRegions,
} from "@/lib/db/schema/reimbursements";
import { hackerRsvpExceptions, hackerRsvps } from "@/lib/db/schema/rsvps";
import { RSVP_DEADLINE_MS, isRsvpOpen } from "@/lib/rsvp/deadline";
import {
  hasApprovedTravelAward,
  type RsvpTravelEligibilitySource,
} from "@/lib/rsvp/travel-eligibility";

export type RsvpTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export type RsvpAccess = {
  open: boolean;
  closesAt: string | null;
  source: "global" | "exception" | null;
};

export function assertAcceptedRsvpDecision(
  decision: ApplicationDecision,
): void {
  if (decisionOutcome(decision) !== "accepted") {
    throw new Error("An accepted MHacks 2026 application is required to RSVP");
  }
}

function activeExceptionFilter(userId: string, now: Date) {
  return and(
    eq(hackerRsvpExceptions.userId, userId),
    isNull(hackerRsvpExceptions.revokedAt),
    gt(hackerRsvpExceptions.expiresAt, now.toISOString()),
  );
}

function rsvpAccessFromException(
  exception: { expiresAt: string } | null | undefined,
  nowMs: number,
): RsvpAccess {
  const globalClosesAtMs = isRsvpOpen(nowMs) ? RSVP_DEADLINE_MS : null;
  const exceptionClosesAtMs = exception
    ? Date.parse(exception.expiresAt)
    : null;
  const closesAtMs = Math.max(
    globalClosesAtMs ?? Number.NEGATIVE_INFINITY,
    exceptionClosesAtMs ?? Number.NEGATIVE_INFINITY,
  );

  if (!Number.isFinite(closesAtMs)) {
    return { open: false, closesAt: null, source: null };
  }

  return {
    open: true,
    closesAt: new Date(closesAtMs).toISOString(),
    source: closesAtMs === exceptionClosesAtMs ? "exception" : "global",
  };
}

export async function getRsvpAccessForUser({
  userId,
  nowMs = Date.now(),
}: {
  userId: string;
  nowMs?: number;
}): Promise<RsvpAccess> {
  const now = new Date(nowMs);
  const [exception] = await db
    .select({ expiresAt: hackerRsvpExceptions.expiresAt })
    .from(hackerRsvpExceptions)
    .where(activeExceptionFilter(userId, now))
    .orderBy(desc(hackerRsvpExceptions.expiresAt))
    .limit(1);

  return rsvpAccessFromException(exception, nowMs);
}

export async function assertRsvpOpenForUser(
  userId: string,
  nowMs = Date.now(),
): Promise<RsvpAccess> {
  const access = await getRsvpAccessForUser({ userId, nowMs });
  if (!access.open) {
    throw new Error("RSVPs are closed");
  }
  return access;
}

export async function assertRsvpOpenForUserInTransaction(
  tx: RsvpTransaction,
  userId: string,
  nowMs = Date.now(),
): Promise<RsvpAccess> {
  if (isRsvpOpen(nowMs)) {
    return {
      open: true,
      closesAt: new Date(RSVP_DEADLINE_MS).toISOString(),
      source: "global",
    };
  }

  const now = new Date(nowMs);
  const [exception] = await tx
    .select({ expiresAt: hackerRsvpExceptions.expiresAt })
    .from(hackerRsvpExceptions)
    .where(activeExceptionFilter(userId, now))
    .orderBy(desc(hackerRsvpExceptions.expiresAt))
    .limit(1);
  const access = rsvpAccessFromException(exception, nowMs);

  if (!access.open) {
    throw new Error("RSVPs are closed");
  }
  return access;
}

export async function lockWritableRsvpApplicant(
  tx: RsvpTransaction,
  userId: string,
): Promise<RsvpTravelEligibilitySource> {
  await assertRsvpOpenForUserInTransaction(tx, userId);

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

  await assertRsvpOpenForUserInTransaction(tx, userId);
  return {
    transportationType: application.transportationType,
    comingFrom: application.comingFrom,
    needsTravelReimbursement: application.needsTravelReimbursement,
    hasTravelAward: hasApprovedTravelAward(award?.amountCents),
  };
}
