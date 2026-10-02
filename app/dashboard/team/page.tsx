import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { requireHackerPage } from "@/lib/auth/guards";
import {
  getMyTeam,
  getMyPendingInvitations,
  getSentInvitations,
} from "@/lib/actions/team.actions";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { hasCheckedIn, type ApplicationDecision } from "@/lib/decisions";
import {
  getParticipantReservationSnapshot,
  type ParticipantReservationSnapshot,
} from "@/lib/db/queries/reservation";
import { TeamView } from "./team-view";
import { TeamSkeleton } from "./team-skeleton";

// The check-in gate is a database read. Without this, `next build` tries to
// prerender the page and fails when CI has no database.
export const dynamic = "force-dynamic";

// Not wrapped in a swallow-and-degrade try/catch the way apply/page.tsx
// handles its existing-application check — silently falling back to "no
// team" on a fetch error here would let a user attempt to create a second
// team while one already exists, so a failure here is left to throw. It's
// still caught gracefully, just one level up: error.tsx renders it in-shell
// with a retry instead of Next's default error page.
async function TeamData() {
  const { id: userId } = await requireHackerPage();

  // The team page is for hackers whose application decision is checked in.
  let decision: ApplicationDecision | null = null;
  try {
    const [application] = await db
      .select({ decision: hackerApplicants.decision })
      .from(hackerApplicants)
      .where(eq(hackerApplicants.userId, userId))
      .limit(1);
    decision = application?.decision ?? null;
  } catch (err) {
    const cause = err instanceof Error ? (err.cause ?? err) : err;
    console.error("[DB] hacker_applicants team gate query failed:", cause);
  }
  if (!decision || !hasCheckedIn(decision)) {
    redirect("/dashboard");
  }

  const [team, pendingInvitations, sentInvitations] = await Promise.all([
    getMyTeam(userId),
    getMyPendingInvitations(userId),
    getSentInvitations(userId),
  ]);

  let reservations: ParticipantReservationSnapshot | null = null;
  if (team) {
    try {
      reservations = await getParticipantReservationSnapshot();
    } catch (err) {
      const cause = err instanceof Error ? (err.cause ?? err) : err;
      console.error("[DB] reservation snapshot query failed:", cause);
    }
  }

  return (
    <TeamView
      currentUserId={userId}
      team={team}
      pendingInvitations={pendingInvitations}
      sentInvitations={sentInvitations}
      reservations={reservations}
    />
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={<TeamSkeleton />}>
      <TeamData />
    </Suspense>
  );
}
