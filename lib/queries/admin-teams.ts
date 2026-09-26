import { asc, desc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { teamInvitations, teamMembers, teams } from "@/lib/db/schema/teams";
import { users } from "@/lib/db/schema/users";
import type { AdminTeamSummary, TeamMemberSummary } from "@/lib/types/teams";

function displayName(
  firstName: string | null,
  lastName: string | null,
): string | null {
  const full = [firstName, lastName]
    .filter((part): part is string => Boolean(part && part.trim().length > 0))
    .join(" ");
  return full.length > 0 ? full : null;
}

export async function getAllTeamsForAdmin(): Promise<AdminTeamSummary[]> {
  await requireOrganizer();

  const teamRows = await db
    .select({
      id: teams.id,
      name: teams.name,
      createdAt: teams.createdAt,
      renameRequestedAt: teams.renameRequestedAt,
      renameRequestReason: teams.renameRequestReason,
      requesterEmail: users.email,
      requesterFirstName: hackerApplicants.firstName,
      requesterLastName: hackerApplicants.lastName,
    })
    .from(teams)
    // Nullable, set-null-on-delete FK, same rationale as invitedByUserId in
    // getMyPendingInvitations — a removed requester shouldn't erase the
    // request itself.
    .leftJoin(users, eq(users.id, teams.renameRequestedByUserId))
    .leftJoin(hackerApplicants, eq(hackerApplicants.userId, users.id))
    .orderBy(desc(teams.createdAt));

  const memberRows = await db
    .select({
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      joinedAt: teamMembers.joinedAt,
      email: users.email,
      firstName: hackerApplicants.firstName,
      lastName: hackerApplicants.lastName,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .leftJoin(hackerApplicants, eq(hackerApplicants.userId, teamMembers.userId))
    .orderBy(asc(teamMembers.joinedAt));

  const pendingCountRows = await db
    .select({
      teamId: teamInvitations.teamId,
      count: sql<number>`count(*)::int`,
    })
    .from(teamInvitations)
    .where(eq(teamInvitations.status, "pending"))
    .groupBy(teamInvitations.teamId);

  const membersByTeamId = new Map<string, TeamMemberSummary[]>();
  for (const row of memberRows) {
    const summary: TeamMemberSummary = {
      userId: row.userId,
      email: row.email,
      name: displayName(row.firstName, row.lastName),
      joinedAt: row.joinedAt,
    };
    const existing = membersByTeamId.get(row.teamId);
    if (existing) {
      existing.push(summary);
    } else {
      membersByTeamId.set(row.teamId, [summary]);
    }
  }

  const pendingCountByTeamId = new Map(
    pendingCountRows.map((row) => [row.teamId, row.count]),
  );

  return teamRows.map((team) => ({
    id: team.id,
    name: team.name,
    createdAt: team.createdAt,
    members: membersByTeamId.get(team.id) ?? [],
    pendingInviteCount: pendingCountByTeamId.get(team.id) ?? 0,
    renameRequest: team.renameRequestedAt
      ? {
          requestedAt: team.renameRequestedAt,
          reason: team.renameRequestReason,
          requestedByName:
            displayName(team.requesterFirstName, team.requesterLastName) ??
            team.requesterEmail,
        }
      : null,
  }));
}
