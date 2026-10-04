import { and, asc, desc, eq, ne } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { hasCheckedIn, type ApplicationDecision } from "@/lib/decisions";
import { db } from "@/lib/db";
import {
  teams,
  teamMembers,
  teamInvitations,
  teamSubmissions,
  type TeamRow,
  type TeamInvitationRow,
} from "@/lib/db/schema/teams";
import { users } from "@/lib/db/schema/users";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { tables } from "@/lib/db/schema/reservation";
import {
  submissionSettings,
  teamRegistrationSettings,
} from "@/lib/db/schema/teams";
import { SUBMISSION_SETTINGS_ID } from "@/lib/queries/submission-settings";
import { TEAM_REGISTRATION_SETTINGS_ID } from "@/lib/queries/team-registration-settings";
import { getWindowAvailability } from "@/lib/reservation/domain";
import { writeReservationAudit } from "@/lib/reservation/audit";
import {
  MAX_TEAM_SIZE,
  teamNameSchema,
  inviteEmailSchema,
  devpostUrlSchema,
  type MemberTeam,
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
const CHECKED_IN_REQUIRED = "Check in at MHacks before managing a team.";
const PENDING_INVITE_EXISTS =
  "They already have a pending invitation from your team.";
const REGISTRATION_NOT_OPEN = "Team registration has not opened yet.";
const REGISTRATION_CLOSED = "Team registration is closed.";
const SUBMISSION_NOT_OPEN = "Project submissions have not opened yet.";
const SUBMISSION_CLOSED = "Project submissions are closed.";

type TeamQueryClient = Pick<typeof db, "select">;
type TeamTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  if ("code" in err && (err as { code?: unknown }).code === "23505") {
    return true;
  }
  // Drizzle wraps the driver's error in a DrizzleQueryError with it as cause.
  return (
    "cause" in err && isUniqueViolation((err as { cause?: unknown }).cause)
  );
}

function assertCheckedInHacker(
  role: string | null | undefined,
  decision: ApplicationDecision | null | undefined,
): void {
  if (role !== "hacker") {
    throw new Error("Only hackers can manage teams.");
  }
  if (!decision || !hasCheckedIn(decision)) {
    throw new Error(CHECKED_IN_REQUIRED);
  }
}

async function loadHackerAccess(client: TeamQueryClient, userId: string) {
  const [row] = await client
    .select({
      role: users.role,
      decision: hackerApplicants.decision,
    })
    .from(users)
    .leftJoin(hackerApplicants, eq(hackerApplicants.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  return row ?? null;
}

async function loadCheckedInHacker(
  client: TeamQueryClient,
  userId: string,
): Promise<void> {
  const row = await loadHackerAccess(client, userId);
  assertCheckedInHacker(row?.role, row?.decision);
}

async function hackerIsCheckedIn(
  client: TeamQueryClient,
  userId: string,
): Promise<boolean> {
  const row = await loadHackerAccess(client, userId);
  return Boolean(
    row?.role === "hacker" && row.decision && hasCheckedIn(row.decision),
  );
}

function windowClosedError(
  state: "scheduled" | "open" | "closed",
  scheduled: string,
  closed: string,
): string {
  return state === "scheduled" ? scheduled : closed;
}

async function loadRegistrationWindowState(tx: TeamTransaction) {
  const [settings] = await tx
    .select({
      opensAt: teamRegistrationSettings.opensAt,
      closesAt: teamRegistrationSettings.closesAt,
    })
    .from(teamRegistrationSettings)
    .where(eq(teamRegistrationSettings.id, TEAM_REGISTRATION_SETTINGS_ID))
    .for("share")
    .limit(1);
  return getWindowAvailability({
    opensAt: settings?.opensAt,
    closesAt: settings?.closesAt,
  }).state;
}

async function assertRegistrationWindowOpen(
  tx: TeamTransaction,
): Promise<void> {
  const state = await loadRegistrationWindowState(tx);
  if (state !== "open") {
    throw new Error(
      windowClosedError(state, REGISTRATION_NOT_OPEN, REGISTRATION_CLOSED),
    );
  }
}

/**
 * Invitations stay open past registration for a team that holds a table, so
 * a teammate who joins late is still on the team being judged. Call this
 * only while holding the team row lock: organizer moves and removals lock
 * teams before tables, and the FOR SHARE here keeps the table from being
 * released until this transaction commits.
 */
async function assertTeamInvitationsOpen(
  tx: TeamTransaction,
  teamId: string,
): Promise<void> {
  const state = await loadRegistrationWindowState(tx);
  if (state === "open") return;
  const [reservedTable] = await tx
    .select({ id: tables.id })
    .from(tables)
    .where(eq(tables.reservedByTeamId, teamId))
    .for("share")
    .limit(1);
  if (!reservedTable) {
    throw new Error(
      windowClosedError(state, REGISTRATION_NOT_OPEN, REGISTRATION_CLOSED),
    );
  }
}

async function lockTeamForInvitations(
  tx: TeamTransaction,
  teamId: string,
): Promise<void> {
  const [team] = await tx
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.id, teamId))
    .for("update");
  if (!team) {
    throw new Error("This team no longer exists.");
  }
  await assertTeamInvitationsOpen(tx, teamId);
}

async function assertSubmissionWindowOpen(tx: TeamTransaction): Promise<void> {
  const [settings] = await tx
    .select({
      opensAt: submissionSettings.opensAt,
      closesAt: submissionSettings.closesAt,
    })
    .from(submissionSettings)
    .where(eq(submissionSettings.id, SUBMISSION_SETTINGS_ID))
    .for("share")
    .limit(1);
  const state = getWindowAvailability({
    opensAt: settings?.opensAt,
    closesAt: settings?.closesAt,
  }).state;
  if (state !== "open") {
    throw new Error(
      windowClosedError(state, SUBMISSION_NOT_OPEN, SUBMISSION_CLOSED),
    );
  }
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
    await assertRegistrationWindowOpen(tx);
    await loadCheckedInHacker(tx, userId);

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

/** The columns behind MemberTeam, for queries whose result reaches a member. */
const memberTeamColumns = {
  id: teams.id,
  name: teams.name,
  createdAt: teams.createdAt,
  renameRequestedAt: teams.renameRequestedAt,
  renameRequestReason: teams.renameRequestReason,
};

export async function renameTeam(
  userId: string,
  name: string,
): Promise<MemberTeam> {
  const parsedName = teamNameSchema.parse(name);

  return db.transaction(async (tx) => {
    await assertRegistrationWindowOpen(tx);
    await loadCheckedInHacker(tx, userId);

    const [membership] = await tx
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))
      .limit(1);
    if (!membership) {
      throw new Error("You're not on a team.");
    }

    // Locked so an organizer's request landing mid-rename waits for this
    // commit, rather than being cleared by a rename that never saw it.
    const [current] = await tx
      .select({
        name: teams.name,
        renameRequestedAt: teams.renameRequestedAt,
      })
      .from(teams)
      .where(eq(teams.id, membership.teamId))
      .for("update");
    if (!current) {
      throw new Error("Your team no longer exists.");
    }

    // Only a new name resolves an open request. Clearing it on an unchanged
    // save would let a team dismiss the request without doing what it asked.
    const changed = parsedName !== current.name;
    if (current.renameRequestedAt && !changed) {
      throw new Error(
        "Pick a different name. An organizer asked your team to change it.",
      );
    }

    const [team] = await tx
      .update(teams)
      .set({
        name: parsedName,
        ...(changed && {
          renameRequestedAt: null,
          renameRequestReason: null,
          renameRequestedByUserId: null,
        }),
      })
      .where(eq(teams.id, membership.teamId))
      .returning(memberTeamColumns);
    if (!team) {
      throw new Error("Your team no longer exists.");
    }

    return team;
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

    // Lock the team row before counting — not protecting the hard 4-member
    // invariant (acceptInvitation's lock does that), but members plus pending
    // invites must stay within MAX_TEAM_SIZE so open slots can't be spammed.
    const [team] = await tx
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(eq(teams.id, callerTeamId))
      .for("update");
    if (!team) {
      throw new Error("Your team no longer exists.");
    }
    await assertTeamInvitationsOpen(tx, callerTeamId);

    const [inviter] = await tx
      .select({
        email: users.email,
        role: users.role,
        decision: hackerApplicants.decision,
        firstName: hackerApplicants.firstName,
        lastName: hackerApplicants.lastName,
      })
      .from(users)
      .leftJoin(hackerApplicants, eq(hackerApplicants.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    assertCheckedInHacker(inviter?.role, inviter?.decision);
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
    if (!invitedUser.decision || !hasCheckedIn(invitedUser.decision)) {
      throw new Error("They need to check in before they can join a team.");
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

    const currentMembers = await tx
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, callerTeamId));
    const pendingInvites = await tx
      .select({ id: teamInvitations.id })
      .from(teamInvitations)
      .where(
        and(
          eq(teamInvitations.teamId, callerTeamId),
          eq(teamInvitations.status, "pending"),
        ),
      );
    if (currentMembers.length + pendingInvites.length >= MAX_TEAM_SIZE) {
      throw new Error("Your team has no open invite slots.");
    }

    const [existingPendingInvite] = await tx
      .select({ id: teamInvitations.id })
      .from(teamInvitations)
      .where(
        and(
          eq(teamInvitations.teamId, callerTeamId),
          eq(teamInvitations.invitedUserId, invitedUser.id),
          eq(teamInvitations.status, "pending"),
        ),
      )
      .limit(1);
    if (existingPendingInvite) {
      throw new Error(PENDING_INVITE_EXISTS);
    }

    let invitation: TeamInvitationRow;
    try {
      [invitation] = await tx
        .insert(teamInvitations)
        .values({
          teamId: callerTeamId,
          invitedUserId: invitedUser.id,
          invitedByUserId: userId,
        })
        .returning();
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new Error(PENDING_INVITE_EXISTS);
      }
      throw err;
    }

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
    await loadCheckedInHacker(tx, userId);

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
    await assertTeamInvitationsOpen(tx, invitation.teamId);

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
  await db.transaction(async (tx) => {
    await loadCheckedInHacker(tx, userId);

    const [invitation] = await tx
      .select({ teamId: teamInvitations.teamId })
      .from(teamInvitations)
      .where(
        and(
          eq(teamInvitations.id, invitationId),
          eq(teamInvitations.invitedUserId, userId),
          eq(teamInvitations.status, "pending"),
        ),
      )
      .for("update");
    if (!invitation) {
      throw new Error("Invitation not found or already handled.");
    }
    await lockTeamForInvitations(tx, invitation.teamId);

    const now = new Date().toISOString();
    const result = await tx
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
  });
}

export async function cancelInvitation(
  userId: string,
  invitationId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await loadCheckedInHacker(tx, userId);

    const [membership] = await tx
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))
      .limit(1);
    if (!membership) {
      throw new Error("You're not on a team.");
    }

    // Invitation before team, the order acceptInvitation and
    // declineInvitation lock in.
    const [invitation] = await tx
      .select({ id: teamInvitations.id })
      .from(teamInvitations)
      .where(
        and(
          eq(teamInvitations.id, invitationId),
          eq(teamInvitations.teamId, membership.teamId),
          eq(teamInvitations.status, "pending"),
        ),
      )
      .for("update");
    if (!invitation) {
      throw new Error("Invitation not found or already handled.");
    }
    await lockTeamForInvitations(tx, membership.teamId);

    const now = new Date().toISOString();
    const result = await tx
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
  });
}

export async function leaveTeam(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // Check-in is required to join or manage a team, not to leave one. A
    // reverted door scan must not trap someone on a team, even after the
    // registration window has locked.
    if (await hackerIsCheckedIn(tx, userId)) {
      await assertRegistrationWindowOpen(tx);
    }

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
      // tables.reserved_by_team_id is ON DELETE RESTRICT, and reserved_at
      // must be cleared in the same update. Release the table before the
      // team row goes away, or the last member cannot leave.
      await tx
        .update(tables)
        .set({ reservedByTeamId: null, reservedAt: null })
        .where(eq(tables.reservedByTeamId, membership.teamId));
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
    .select(memberTeamColumns)
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
      teamHasTable: sql<boolean>`exists (
        select 1 from ${tables}
        where ${tables.reservedByTeamId} = ${teamInvitations.teamId}
      )`,
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
    teamHasTable: row.teamHasTable,
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

export async function getMyTeamSubmission(
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ devpostUrl: teamSubmissions.devpostUrl })
    .from(teamMembers)
    .innerJoin(teamSubmissions, eq(teamSubmissions.teamId, teamMembers.teamId))
    .where(eq(teamMembers.userId, userId))
    .limit(1);

  return row?.devpostUrl ?? null;
}

export async function saveTeamDevpostUrl(
  userId: string,
  url: string,
): Promise<string> {
  const parsed = devpostUrlSchema.safeParse(url);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Enter a Devpost link");
  }

  return db.transaction(async (tx) => {
    await assertSubmissionWindowOpen(tx);
    await loadCheckedInHacker(tx, userId);

    const [membership] = await tx
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))
      .limit(1);
    if (!membership) {
      throw new Error("You need to be on a team to submit.");
    }

    const [reservedTable] = await tx
      .select({ id: tables.id })
      .from(tables)
      .where(eq(tables.reservedByTeamId, membership.teamId))
      .limit(1);
    if (!reservedTable) {
      throw new Error("Reserve a table before submitting your Devpost link.");
    }

    const now = new Date().toISOString();
    await tx
      .insert(teamSubmissions)
      .values({
        teamId: membership.teamId,
        devpostUrl: parsed.data,
        submittedByUserId: userId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: teamSubmissions.teamId,
        set: {
          devpostUrl: parsed.data,
          submittedByUserId: userId,
          updatedAt: now,
        },
      });

    return parsed.data;
  });
}

// --- Organizer team management --------------------------------------------
// Organizers create teams and place hackers on them directly, without the
// invite round trip and outside the registration window. The member rules
// still hold: checked-in hackers only, one team each, MAX_TEAM_SIZE per team.

export type OrganizerActor = { id: string; email: string };

/**
 * Adds each email's hacker to `teamId` inside `tx`, which must already hold
 * the team row lock. Returns the added emails.
 */
async function addHackersToLockedTeam(
  tx: TeamTransaction,
  organizer: OrganizerActor,
  teamId: string,
  emails: string[],
): Promise<string[]> {
  const normalized = [
    ...new Set(emails.map((email) => inviteEmailSchema.parse(email))),
  ];
  if (normalized.length === 0) {
    throw new Error("Enter at least one hacker's email.");
  }

  const currentMembers = await tx
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));
  if (currentMembers.length + normalized.length > MAX_TEAM_SIZE) {
    throw new Error(
      `Teams can have up to ${MAX_TEAM_SIZE} hackers. This team has ${currentMembers.length}.`,
    );
  }

  const now = new Date().toISOString();
  for (const email of normalized) {
    const [hacker] = await tx
      .select({
        id: users.id,
        role: users.role,
        decision: hackerApplicants.decision,
      })
      .from(users)
      .leftJoin(hackerApplicants, eq(hackerApplicants.userId, users.id))
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    if (!hacker) {
      throw new Error(`No account found for ${email}.`);
    }
    if (hacker.role !== "hacker") {
      throw new Error(`${email} isn't a hacker account.`);
    }
    if (!hacker.decision || !hasCheckedIn(hacker.decision)) {
      throw new Error(`${email} needs to check in before joining a team.`);
    }
    const [membership] = await tx
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, hacker.id))
      .limit(1);
    if (membership) {
      throw new Error(
        membership.teamId === teamId
          ? `${email} is already on this team.`
          : `${email} is already on a team.`,
      );
    }

    try {
      await tx.insert(teamMembers).values({ userId: hacker.id, teamId });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new Error(`${email} is already on a team.`);
      }
      throw err;
    }

    // Same as acceptInvitation: one team per user, so their other pending
    // invites can no longer be accepted.
    await tx
      .update(teamInvitations)
      .set({ status: "cancelled", respondedAt: now })
      .where(
        and(
          eq(teamInvitations.invitedUserId, hacker.id),
          eq(teamInvitations.status, "pending"),
        ),
      );

    await writeReservationAudit(tx, {
      actorUserId: organizer.id,
      actorEmail: organizer.email,
      action: "team.member_added",
      entityType: "team",
      entityId: teamId,
      details: { email },
    });
  }
  return normalized;
}

/**
 * Creates a team with its first members. A team always has a member: the
 * last one leaving deletes it, so an empty team would never be cleaned up.
 */
export async function createTeamAsOrganizer(
  organizer: OrganizerActor,
  name: string,
  emails: string[],
): Promise<{ team: TeamRow; added: string[] }> {
  const parsedName = teamNameSchema.parse(name);

  return db.transaction(async (tx) => {
    const [team] = await tx
      .insert(teams)
      .values({ name: parsedName, createdByUserId: organizer.id })
      .returning();
    if (!team) {
      throw new Error("Could not create the team.");
    }
    // Nobody else can see the new row yet, but take the same lock the other
    // membership paths take so the helper's contract holds.
    await tx
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.id, team.id))
      .for("update");
    await writeReservationAudit(tx, {
      actorUserId: organizer.id,
      actorEmail: organizer.email,
      action: "team.created",
      entityType: "team",
      entityId: team.id,
      details: { name: parsedName },
    });
    const added = await addHackersToLockedTeam(tx, organizer, team.id, emails);
    return { team, added };
  });
}

export async function addTeamMemberAsOrganizer(
  organizer: OrganizerActor,
  teamId: string,
  email: string,
): Promise<string> {
  return db.transaction(async (tx) => {
    // The lock acceptInvitation and leaveTeam take, so the size check below
    // can't race a concurrent join or the team being deleted.
    const [team] = await tx
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.id, teamId))
      .for("update");
    if (!team) {
      throw new Error("Team not found.");
    }
    const [added] = await addHackersToLockedTeam(tx, organizer, teamId, [
      email,
    ]);
    return added;
  });
}

/**
 * Takes a hacker off a team. Removing the last member deletes the team, the
 * same as the last member leaving: its table is released first, since
 * tables.reserved_by_team_id is ON DELETE RESTRICT.
 */
export async function removeTeamMemberAsOrganizer(
  organizer: OrganizerActor,
  teamId: string,
  memberUserId: string,
): Promise<{ email: string; teamDeleted: boolean }> {
  return db.transaction(async (tx) => {
    // The lock leaveTeam and acceptInvitation take on the same row.
    const [team] = await tx
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(eq(teams.id, teamId))
      .for("update");
    if (!team) {
      throw new Error("Team not found.");
    }

    const [member] = await tx
      .select({ email: users.email })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, memberUserId),
        ),
      )
      .limit(1);
    if (!member) {
      throw new Error("That hacker is no longer on this team.");
    }

    await tx.delete(teamMembers).where(eq(teamMembers.userId, memberUserId));

    const remainingMembers = await tx
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));
    const teamDeleted = remainingMembers.length === 0;
    let releasedTables: number[] = [];
    if (teamDeleted) {
      const released = await tx
        .update(tables)
        .set({ reservedByTeamId: null, reservedAt: null })
        .where(eq(tables.reservedByTeamId, teamId))
        .returning({ number: tables.number });
      releasedTables = released.map((table) => table.number);
      await tx.delete(teams).where(eq(teams.id, teamId));
    }

    await writeReservationAudit(tx, {
      actorUserId: organizer.id,
      actorEmail: organizer.email,
      action: "team.member_removed",
      entityType: "team",
      entityId: teamId,
      details: {
        email: member.email,
        teamName: team.name,
        teamDeleted,
        releasedTables,
      },
    });
    return { email: member.email, teamDeleted };
  });
}

/**
 * Sets or clears a team's Devpost link. Unlike saveTeamDevpostUrl, the
 * submission window and the reserved-table requirement do not apply. An
 * empty `url` removes the link.
 */
export async function setTeamDevpostUrlAsOrganizer(
  organizer: OrganizerActor,
  teamId: string,
  url: string,
): Promise<string | null> {
  const trimmed = url.trim();
  let devpostUrl: string | null = null;
  if (trimmed) {
    const parsed = devpostUrlSchema.safeParse(trimmed);
    if (!parsed.success) {
      throw new Error(
        parsed.error.issues[0]?.message ?? "Enter a Devpost link",
      );
    }
    devpostUrl = parsed.data;
  }

  return db.transaction(async (tx) => {
    // The lock the membership paths take, so this can't race the last
    // member leaving and the team being deleted.
    const [team] = await tx
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.id, teamId))
      .for("update");
    if (!team) {
      throw new Error("Team not found.");
    }

    const [previous] = await tx
      .select({ devpostUrl: teamSubmissions.devpostUrl })
      .from(teamSubmissions)
      .where(eq(teamSubmissions.teamId, teamId))
      .limit(1);

    if (devpostUrl === null) {
      await tx
        .delete(teamSubmissions)
        .where(eq(teamSubmissions.teamId, teamId));
    } else {
      const now = new Date().toISOString();
      await tx
        .insert(teamSubmissions)
        .values({
          teamId,
          devpostUrl,
          submittedByUserId: organizer.id,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: teamSubmissions.teamId,
          set: { devpostUrl, submittedByUserId: organizer.id, updatedAt: now },
        });
    }

    await writeReservationAudit(tx, {
      actorUserId: organizer.id,
      actorEmail: organizer.email,
      action: "team.devpost_updated",
      entityType: "team",
      entityId: teamId,
      details: { from: previous?.devpostUrl ?? null, to: devpostUrl },
    });
    return devpostUrl;
  });
}
