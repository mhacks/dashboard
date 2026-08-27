import { and, asc, desc, eq, ne } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  teams,
  teamMembers,
  teamInvitations,
  type TeamRow,
  type TeamInvitationRow,
} from "@/lib/db/schema/teams";
import { users } from "@/lib/db/schema/users";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { decisionOutcome } from "@/lib/decisions";
import {
  MAX_TEAM_SIZE,
  teamNameSchema,
  inviteEmailSchema,
  type TeamWithMembers,
  type PendingInvitationSummary,
  type SentInvitationSummary,
} from "@/lib/types/teams";

// Core team logic, parameterized by `userId`, following the same shape as
// application-form.actions.ts. Every mutation re-derives scope from `userId`
// itself — never trust a caller-supplied teamId — since these functions are
// called from server actions that run through the trusted `db` connection,
// not RLS-checked per request.

const ALREADY_ON_A_TEAM = "You're already on a team — leave it first.";

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "23505"
  );
}

function displayName(
  firstName: string | null,
  lastName: string | null,
): string | null {
  const full = [firstName, lastName]
    .filter((part): part is string => Boolean(part && part.trim().length > 0))
    .join(" ");
  return full.length > 0 ? full : null;
}

export async function createTeamForUser(
  userId: string,
  name: string,
): Promise<TeamRow> {
  const parsedName = teamNameSchema.parse(name);

  return db.transaction(async (tx) => {
    const [existingMembership] = await tx
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))
      .limit(1);
    if (existingMembership) {
      throw new Error(ALREADY_ON_A_TEAM);
    }

    try {
      const [team] = await tx
        .insert(teams)
        .values({ name: parsedName, createdByUserId: userId })
        .returning();

      await tx.insert(teamMembers).values({ userId, teamId: team.id });

      return team;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new Error(ALREADY_ON_A_TEAM);
      }
      throw err;
    }
  });
}

export type TeamInvitationWithContext = {
  invitation: TeamInvitationRow;
  invitedEmail: string;
  teamName: string;
  inviterName: string;
};

export async function inviteToTeam(
  userId: string,
  email: string,
): Promise<TeamInvitationWithContext> {
  const normalizedEmail = inviteEmailSchema.parse(email);

  return db.transaction(async (tx) => {
    const [membership] = await tx
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))
      .limit(1);
    if (!membership) {
      throw new Error("You need to be on a team to invite people.");
    }
    const callerTeamId = membership.teamId;

    const [inviter] = await tx
      .select({
        email: users.email,
        firstName: hackerApplicants.firstName,
        lastName: hackerApplicants.lastName,
      })
      .from(users)
      .leftJoin(hackerApplicants, eq(hackerApplicants.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    const inviterName =
      displayName(inviter?.firstName ?? null, inviter?.lastName ?? null) ??
      inviter?.email ??
      "A teammate";

    const [invitedUser] = await tx
      .select({
        id: users.id,
        role: users.role,
        decision: hackerApplicants.decision,
      })
      .from(users)
      .leftJoin(hackerApplicants, eq(hackerApplicants.userId, users.id))
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1);
    if (!invitedUser) {
      throw new Error("No account found with that email.");
    }
    if (invitedUser.id === userId) {
      throw new Error("You can't invite yourself.");
    }
    if (invitedUser.role !== "hacker") {
      throw new Error("That account can't join a team.");
    }
    if (
      !invitedUser.decision ||
      decisionOutcome(invitedUser.decision) !== "accepted"
    ) {
      throw new Error("They haven't been accepted to MHacks yet.");
    }

    const [invitedMembership] = await tx
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, invitedUser.id))
      .limit(1);
    if (invitedMembership) {
      throw new Error(
        invitedMembership.teamId === callerTeamId
          ? "They're already on your team."
          : "They're already on a team.",
      );
    }

    // Lock the team row before counting — not protecting the hard 4-member
    // invariant (acceptInvitation's lock does that), just stops the team
    // from visibly sending more invites than it has open slots for.
    const [team] = await tx
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(eq(teams.id, callerTeamId))
      .for("update");
    if (!team) {
      throw new Error("Your team no longer exists.");
    }

    const currentMembers = await tx
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, callerTeamId));
    if (currentMembers.length >= MAX_TEAM_SIZE) {
      throw new Error("Your team is full.");
    }

    const [invitation] = await tx
      .insert(teamInvitations)
      .values({
        teamId: callerTeamId,
        invitedUserId: invitedUser.id,
        invitedByUserId: userId,
      })
      .returning();

    return {
      invitation,
      invitedEmail: normalizedEmail,
      teamName: team.name,
      inviterName,
    };
  });
}

export async function acceptInvitation(
  userId: string,
  invitationId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [invitation] = await tx
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.id, invitationId))
      .for("update");
    if (!invitation) {
      throw new Error("Invitation not found.");
    }
    if (invitation.status !== "pending") {
      throw new Error("This invitation is no longer pending.");
    }
    if (invitation.invitedUserId !== userId) {
      throw new Error("This invitation isn't addressed to you.");
    }

    const [existingMembership] = await tx
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))
      .limit(1);
    if (existingMembership) {
      throw new Error(ALREADY_ON_A_TEAM);
    }

    // Lock the target team row — the same lock inviteToTeam takes — so two
    // different pending invitations to this team can't both read a stale
    // member count and both get accepted past the 4-person cap. This also
    // serializes against a concurrent leaveTeam on the same team (see the
    // leave-vs-accept scenario in the plan).
    const [team] = await tx
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.id, invitation.teamId))
      .for("update");
    if (!team) {
      throw new Error("This team no longer exists.");
    }

    const currentMembers = await tx
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, invitation.teamId));
    if (currentMembers.length >= MAX_TEAM_SIZE) {
      throw new Error("That team is full.");
    }

    const now = new Date().toISOString();

    try {
      await tx
        .insert(teamMembers)
        .values({ userId, teamId: invitation.teamId });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new Error(ALREADY_ON_A_TEAM);
      }
      throw err;
    }

    await tx
      .update(teamInvitations)
      .set({ status: "accepted", respondedAt: now })
      .where(eq(teamInvitations.id, invitationId));

    // A user can only be on one team — cancel their other pending invites
    // so they don't dangle as unacceptable.
    await tx
      .update(teamInvitations)
      .set({ status: "cancelled", respondedAt: now })
      .where(
        and(
          eq(teamInvitations.invitedUserId, userId),
          eq(teamInvitations.status, "pending"),
          ne(teamInvitations.id, invitationId),
        ),
      );
  });
}

export async function declineInvitation(
  userId: string,
  invitationId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const result = await db
    .update(teamInvitations)
    .set({ status: "declined", respondedAt: now })
    .where(
      and(
        eq(teamInvitations.id, invitationId),
        eq(teamInvitations.invitedUserId, userId),
        eq(teamInvitations.status, "pending"),
      ),
    )
    .returning({ id: teamInvitations.id });

  if (result.length === 0) {
    throw new Error("Invitation not found or already handled.");
  }
}

export async function cancelInvitation(
  userId: string,
  invitationId: string,
): Promise<void> {
  const [membership] = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .limit(1);
  if (!membership) {
    throw new Error("You're not on a team.");
  }

  const now = new Date().toISOString();
  const result = await db
    .update(teamInvitations)
    .set({ status: "cancelled", respondedAt: now })
    .where(
      and(
        eq(teamInvitations.id, invitationId),
        eq(teamInvitations.teamId, membership.teamId),
        eq(teamInvitations.status, "pending"),
      ),
    )
    .returning({ id: teamInvitations.id });

  if (result.length === 0) {
    throw new Error("Invitation not found or already handled.");
  }
}

export async function leaveTeam(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [membership] = await tx
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))
      .limit(1);
    if (!membership) {
      throw new Error("You're not on a team.");
    }

    // Lock the team row first — deleting just this user's own team_members
    // row (keyed by user_id) doesn't block a teammate doing the same thing
    // concurrently, which is what causes the empty-team orphan race. This
    // lock is also what serializes against a concurrent acceptInvitation
    // landing on the same team.
    const [team] = await tx
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.id, membership.teamId))
      .for("update");
    if (!team) {
      return;
    }

    await tx.delete(teamMembers).where(eq(teamMembers.userId, userId));

    const remainingMembers = await tx
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, membership.teamId));

    if (remainingMembers.length === 0) {
      await tx.delete(teams).where(eq(teams.id, membership.teamId));
    }
  });
}

export async function getMyTeam(
  userId: string,
): Promise<TeamWithMembers | null> {
  const [membership] = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .limit(1);
  if (!membership) return null;

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, membership.teamId))
    .limit(1);
  if (!team) return null;

  const memberRows = await db
    .select({
      userId: teamMembers.userId,
      joinedAt: teamMembers.joinedAt,
      email: users.email,
      firstName: hackerApplicants.firstName,
      lastName: hackerApplicants.lastName,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .leftJoin(hackerApplicants, eq(hackerApplicants.userId, teamMembers.userId))
    .where(eq(teamMembers.teamId, team.id))
    .orderBy(asc(teamMembers.joinedAt));

  return {
    team,
    members: memberRows.map((row) => ({
      userId: row.userId,
      email: row.email,
      name: displayName(row.firstName, row.lastName),
      joinedAt: row.joinedAt,
    })),
  };
}

export async function getMyPendingInvitations(
  userId: string,
): Promise<PendingInvitationSummary[]> {
  const rows = await db
    .select({
      id: teamInvitations.id,
      teamId: teamInvitations.teamId,
      teamName: teams.name,
      createdAt: teamInvitations.createdAt,
      inviterEmail: users.email,
      inviterFirstName: hackerApplicants.firstName,
      inviterLastName: hackerApplicants.lastName,
    })
    .from(teamInvitations)
    .innerJoin(teams, eq(teams.id, teamInvitations.teamId))
    // invitedByUserId is nullable (onDelete: "set null") — leftJoin, not an
    // inner join, so the invitation doesn't vanish if the inviter's account
    // is ever removed (see the Data Model "audit only" rationale).
    .leftJoin(users, eq(users.id, teamInvitations.invitedByUserId))
    .leftJoin(
      hackerApplicants,
      eq(hackerApplicants.userId, teamInvitations.invitedByUserId),
    )
    .where(
      and(
        eq(teamInvitations.invitedUserId, userId),
        eq(teamInvitations.status, "pending"),
      ),
    )
    .orderBy(desc(teamInvitations.createdAt));

  return rows.map((row) => ({
    id: row.id,
    teamId: row.teamId,
    teamName: row.teamName,
    createdAt: row.createdAt,
    invitedByName:
      displayName(row.inviterFirstName, row.inviterLastName) ??
      row.inviterEmail ??
      "someone",
  }));
}

export async function getSentInvitations(
  userId: string,
): Promise<SentInvitationSummary[]> {
  const [membership] = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .limit(1);
  if (!membership) return [];

  const rows = await db
    .select({
      id: teamInvitations.id,
      status: teamInvitations.status,
      createdAt: teamInvitations.createdAt,
      respondedAt: teamInvitations.respondedAt,
      invitedEmail: users.email,
      invitedFirstName: hackerApplicants.firstName,
      invitedLastName: hackerApplicants.lastName,
    })
    .from(teamInvitations)
    .innerJoin(users, eq(users.id, teamInvitations.invitedUserId))
    .leftJoin(
      hackerApplicants,
      eq(hackerApplicants.userId, teamInvitations.invitedUserId),
    )
    .where(eq(teamInvitations.teamId, membership.teamId))
    .orderBy(desc(teamInvitations.createdAt));

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    respondedAt: row.respondedAt,
    invitedEmail: row.invitedEmail,
    invitedName: displayName(row.invitedFirstName, row.invitedLastName),
  }));
}
