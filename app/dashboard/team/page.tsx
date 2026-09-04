import { Suspense } from "react";
import { requireHackerPage } from "@/lib/auth/guards";
import {
  getMyTeam,
  getMyPendingInvitations,
  getSentInvitations,
} from "@/lib/actions/team.actions";
import { TeamView } from "./team-view";
import { TeamSkeleton } from "./team-skeleton";

// Not wrapped in a swallow-and-degrade try/catch the way apply/page.tsx
// handles its existing-application check — silently falling back to "no
// team" on a fetch error here would let a user attempt to create a second
// team while one already exists, so a failure here is left to throw. It's
// still caught gracefully, just one level up: error.tsx renders it in-shell
// with a retry instead of Next's default error page.
async function TeamData() {
  const { id: userId } = await requireHackerPage();

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
