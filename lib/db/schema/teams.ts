import {
  check,
  pgTable,
  pgEnum,
  pgPolicy,
  uuid,
  text,
  timestamp,
  foreignKey,
  index,
  uniqueIndex,
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
    // Set together by an organizer asking the team to pick a new name.
    // Cleared together (all three, back to null) the moment the team
    // actually renames — see renameTeam in lib/actions/team.actions.ts.
    renameRequestedAt: timestamp("rename_requested_at", {
      withTimezone: true,
      mode: "string",
    }),
    renameRequestReason: text("rename_request_reason"),
    renameRequestedByUserId: uuid("rename_requested_by_user_id"), // audit only, same rationale as createdByUserId
  },
  (table) => [
    foreignKey({
      columns: [table.createdByUserId],
      foreignColumns: [users.id],
      name: "teams_created_by_user_id_users_id_fk",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.renameRequestedByUserId],
      foreignColumns: [users.id],
      name: "teams_rename_requested_by_user_id_users_id_fk",
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
    uniqueIndex("team_invitations_pending_team_invitee_uidx")
      .on(table.teamId, table.invitedUserId)
      .where(sql`${table.status} = 'pending'`),
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

/**
 * One row per team. `team_id` is the primary key, so a second submission
 * replaces the first instead of creating another project link.
 */
export const teamSubmissions = pgTable(
  "team_submissions",
  {
    teamId: uuid("team_id").primaryKey().notNull(),
    devpostUrl: text("devpost_url").notNull(),
    submittedByUserId: uuid("submitted_by_user_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: "team_submissions_team_id_teams_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.submittedByUserId],
      foreignColumns: [users.id],
      name: "team_submissions_submitted_by_user_id_users_id_fk",
    }).onDelete("set null"),
    pgPolicy("team_submissions_select_member_or_organizer", {
      for: "select",
      to: authenticatedRole,
      using: sql`exists (
        select 1 from team_members
        where team_members.team_id = ${table.teamId}
          and team_members.user_id = ${authUid}
      ) OR ${isOrganizer}`,
    }),
  ],
).enableRLS();

/**
 * One row, id `default`. Organizers set when hackers can create a team, invite,
 * accept, decline, cancel, rename, or leave. A missing row is closed.
 */
export const teamRegistrationSettings = pgTable(
  "team_registration_settings",
  {
    id: text().primaryKey().default("default").notNull(),
    opensAt: timestamp("opens_at", { withTimezone: true, mode: "string" }),
    closesAt: timestamp("closes_at", { withTimezone: true, mode: "string" }),
    updatedByUserId: uuid("updated_by_user_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "team_registration_settings_singleton_check",
      sql`${table.id} = 'default'`,
    ),
    check(
      "team_registration_settings_window_valid",
      sql`${table.opensAt} IS NULL
        OR ${table.closesAt} IS NULL
        OR ${table.closesAt} > ${table.opensAt}`,
    ),
    foreignKey({
      columns: [table.updatedByUserId],
      foreignColumns: [users.id],
      name: "team_registration_settings_updated_by_user_id_fkey",
    }).onDelete("set null"),
    pgPolicy("team_registration_settings_authenticated_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`(select public.is_organizer()) OR (select public.has_accepted_reservation_access())`,
    }),
    pgPolicy("team_registration_settings_organizer_all", {
      for: "all",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
  ],
).enableRLS();

/**
 * One row, id `default`. Organizers set when a team can save its Devpost link.
 * A missing row is closed. The team must also hold a table.
 */
export const submissionSettings = pgTable(
  "submission_settings",
  {
    id: text().primaryKey().default("default").notNull(),
    opensAt: timestamp("opens_at", { withTimezone: true, mode: "string" }),
    closesAt: timestamp("closes_at", { withTimezone: true, mode: "string" }),
    updatedByUserId: uuid("updated_by_user_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("submission_settings_singleton_check", sql`${table.id} = 'default'`),
    check(
      "submission_settings_window_valid",
      sql`${table.opensAt} IS NULL
        OR ${table.closesAt} IS NULL
        OR ${table.closesAt} > ${table.opensAt}`,
    ),
    foreignKey({
      columns: [table.updatedByUserId],
      foreignColumns: [users.id],
      name: "submission_settings_updated_by_user_id_fkey",
    }).onDelete("set null"),
    pgPolicy("submission_settings_authenticated_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`(select public.is_organizer()) OR (select public.has_accepted_reservation_access())`,
    }),
    pgPolicy("submission_settings_organizer_all", {
      for: "all",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
  ],
).enableRLS();

export type TeamRow = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMemberRow = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type TeamInvitationRow = typeof teamInvitations.$inferSelect;
export type NewTeamInvitation = typeof teamInvitations.$inferInsert;
