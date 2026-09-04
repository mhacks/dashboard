import {
  pgTable,
  pgEnum,
  pgPolicy,
  uuid,
  text,
  timestamp,
  foreignKey,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUid, authenticatedRole } from "drizzle-orm/supabase";
import { isOrganizer } from "./rls";
import { users } from "./users";

export const teams = pgTable(
  "teams",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    createdByUserId: uuid("created_by_user_id"), // audit only — no owner/permission semantics, anyone on the team can invite/leave
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.createdByUserId],
      foreignColumns: [users.id],
      name: "teams_created_by_user_id_users_id_fk",
    }).onDelete("set null"),
    pgPolicy("teams_select_member_or_organizer", {
      for: "select",
      to: authenticatedRole,
      using: sql`exists (
        select 1 from team_members
        where team_members.team_id = ${table.id}
          and team_members.user_id = ${authUid}
      ) OR ${isOrganizer}`,
    }),
  ],
).enableRLS();

export const teamMembers = pgTable(
  "team_members",
  {
    // userId as the PK (not a team_id, user_id composite) is what makes "one
    // team per user" a real DB guarantee instead of an app-level check.
    userId: uuid("user_id").primaryKey().notNull(),
    teamId: uuid("team_id").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "team_members_user_id_users_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: "team_members_team_id_teams_id_fk",
    }).onDelete("cascade"),
    // supports leaveTeam's "count remaining members for this team" scan
    index("team_members_team_id_idx").on(table.teamId),
    pgPolicy("team_members_select_teammates_or_organizer", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.teamId} in (
        select team_id from team_members where user_id = ${authUid}
      ) OR ${isOrganizer}`,
    }),
  ],
).enableRLS();

export const teamInvitationStatus = pgEnum("team_invitation_status", [
  "pending",
  "accepted",
  "declined",
  "cancelled",
]);
export type TeamInvitationStatus =
  (typeof teamInvitationStatus.enumValues)[number];

export const teamInvitations = pgTable(
  "team_invitations",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    teamId: uuid("team_id").notNull(),
    invitedUserId: uuid("invited_user_id").notNull(),
    invitedByUserId: uuid("invited_by_user_id"), // audit only, same rationale as teams.createdByUserId
    status: teamInvitationStatus().default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    respondedAt: timestamp("responded_at", {
      withTimezone: true,
      mode: "string",
    }), // set on accept, decline, or cancel
  },
  (table) => [
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: "team_invitations_team_id_teams_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.invitedUserId],
      foreignColumns: [users.id],
      name: "team_invitations_invited_user_id_users_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.invitedByUserId],
      foreignColumns: [users.id],
      name: "team_invitations_invited_by_user_id_users_id_fk",
    }).onDelete("set null"), // preserve the invitation record itself if the inviter's account is later removed
    // supports getMyPendingInvitations (invitee's inbox)
    index("team_invitations_invited_user_id_idx").on(table.invitedUserId),
    // supports getSentInvitations (team's outbox)
    index("team_invitations_team_id_idx").on(table.teamId),
    pgPolicy("team_invitations_select_own_or_team_or_organizer", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.invitedUserId} = ${authUid}
        OR ${table.teamId} in (
          select team_id from team_members where user_id = ${authUid}
        )
        OR ${isOrganizer}`,
    }),
  ],
).enableRLS();

export type TeamRow = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMemberRow = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type TeamInvitationRow = typeof teamInvitations.$inferSelect;
export type NewTeamInvitation = typeof teamInvitations.$inferInsert;
