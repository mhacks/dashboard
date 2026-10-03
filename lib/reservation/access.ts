import { eq } from "drizzle-orm";
import { hasCheckedIn, type ApplicationDecision } from "@/lib/decisions";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { teamMembers, teams } from "@/lib/db/schema/teams";

export const CHECKED_IN_RESERVATION_ERROR =
  "Check in at MHacks before reserving a table.";

export class ReservationAccessError extends Error {
  constructor() {
    super(CHECKED_IN_RESERVATION_ERROR);
    this.name = "ReservationAccessError";
  }
}

export function isCheckedInReservationDecision(
  decision: ApplicationDecision,
): boolean {
  return hasCheckedIn(decision);
}

export async function getParticipantTeam(
  userId: string,
): Promise<{ teamId: string; teamName: string } | null> {
  const [row] = await db
    .select({ teamId: teamMembers.teamId, teamName: teams.name })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, userId))
    .limit(1);

  return row ?? null;
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
    application && isCheckedInReservationDecision(application.decision),
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

  if (!application || !isCheckedInReservationDecision(application.decision)) {
    throw new ReservationAccessError();
  }
}
