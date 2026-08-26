import { eq } from "drizzle-orm";
import { decisionOutcome, type ApplicationDecision } from "@/lib/decisions";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";

export const ACCEPTED_RESERVATION_ERROR =
  "An accepted MHacks 2026 application is required to reserve a table.";

export class ReservationAccessError extends Error {
  constructor() {
    super(ACCEPTED_RESERVATION_ERROR);
    this.name = "ReservationAccessError";
  }
}

export function isAcceptedReservationDecision(
  decision: ApplicationDecision,
): boolean {
  return decisionOutcome(decision) === "accepted";
}

export async function hasAcceptedReservationAccess(
  userId: string,
): Promise<boolean> {
  const [application] = await db
    .select({ decision: hackerApplicants.decision })
    .from(hackerApplicants)
    .where(eq(hackerApplicants.userId, userId))
    .limit(1);

  return Boolean(
    application && isAcceptedReservationDecision(application.decision),
  );
}

type ReservationTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export async function lockAcceptedReservationApplicant(
  tx: ReservationTransaction,
  userId: string,
): Promise<void> {
  const [application] = await tx
    .select({ decision: hackerApplicants.decision })
    .from(hackerApplicants)
    .where(eq(hackerApplicants.userId, userId))
    .for("share")
    .limit(1);

  if (!application || !isAcceptedReservationDecision(application.decision)) {
    throw new ReservationAccessError();
  }
}
