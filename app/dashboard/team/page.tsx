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
import { decisionOutcome, type ApplicationDecision } from "@/lib/decisions";
import { TEAM_PAGE_ENABLED } from "@/lib/features";
import { TeamView } from "./team-view";
import { TeamSkeleton } from "./team-skeleton";

// Not wrapped in a swallow-and-degrade try/catch the way apply/page.tsx
// handles its existing-application check — silently falling back to "no
// team" on a fetch error here would let a user attempt to create a second
// team while one already exists, so a failure here is left to throw. It's
// still caught gracefully, just one level up: error.tsx renders it in-shell
// with a retry instead of Next's default error page.
async function TeamData() {
  if (!TEAM_PAGE_ENABLED) redirect("/dashboard");

  const { id: userId } = await requireHackerPage();

  // Same gate as /dashboard/pass and team mutations: accepted hackers only.
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
  if (!decision || decisionOutcome(decision) !== "accepted") {
    redirect("/dashboard");
  }

  const [team, pendingInvitations, sentInvitations] = await Promise.all([
    getMyTeam(userId),
    getMyPendingInvitations(userId),
    getSentInvitations(userId),
  ]);

  return (
    <TeamView
      currentUserId={userId}
      team={team}
      pendingInvitations={pendingInvitations}
      sentInvitations={sentInvitations}
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
