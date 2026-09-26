import {
  foreignKey,
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUid, authenticatedRole } from "drizzle-orm/supabase";
import { isOrganizer } from "./rls";
import { users } from "./users";

// Links a dashboard account to the Discord account that verified it through the
// MHacks Discord bot (github.com/mhacks/mhacks-discord-bot). One-to-one in both
// directions: the primary key stops a person linking two Discord accounts, and
// the unique on discord_user_id stops one Discord account claiming two people.
//
// Written by the dashboard's /discord_auth confirm screen once the signed-in
// account approves the link the bot handed it. authenticated gets read access to
// its own row and organizers to all, nothing more; writes go through Drizzle on
// the owner connection, which bypasses RLS.
export const discordAccounts = pgTable(
  "discord_accounts",
  {
    userId: uuid("user_id").primaryKey().notNull(),
    discordUserId: text("discord_user_id").notNull(),
    discordUsername: text("discord_username"),
    verifiedAt: timestamp("verified_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "discord_accounts_user_id_fkey",
    }).onDelete("cascade"),
    unique("discord_accounts_discord_user_id_unique").on(table.discordUserId),
    pgPolicy("discord_accounts_select_own_or_organizer", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid} OR ${isOrganizer}`,
    }),
  ],
).enableRLS();

/**
 * Append-only history of every Discord link: the first association, a
 * re-confirmation, a replacement, and a refused attempt. `discord_accounts`
 * only ever holds the current state, so without this there is no way to answer
 * "who used to own this Discord account" after the fact.
 *
 * user_id is ON DELETE SET NULL, not cascade like discord_accounts.user_id:
 * deleting an account erases the link itself, and an audit trail that vanishes
 * with the thing it audits is not one. user_email is denormalised for the same
 * reason — it is the only identifying trace left once the row is orphaned.
 * Mirrors reservation_audit_log, which keeps actor_email and event_name.
 */
export const discordLinkAction = [
  "linked",
  "relinked",
  "replaced",
  "link_refused",
  "role_granted",
] as const;
export type DiscordLinkAction = (typeof discordLinkAction)[number];

export interface DiscordLinkAuditDetails {
  previousDiscordUserId?: string;
  previousDiscordUsername?: string | null;
  reason?: string;
  role?: string;
}

export const discordLinkAuditLog = pgTable(
  "discord_link_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id"),
    userEmail: text("user_email").notNull(),
    discordUserId: text("discord_user_id").notNull(),
    discordUsername: text("discord_username"),
    // Plain text, not an enum: these are log labels, and adding one should not
    // need a migration that rewrites a type other tables might come to share.
    action: text("action").notNull().$type<DiscordLinkAction>(),
    details: jsonb("details")
      .$type<DiscordLinkAuditDetails>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "discord_link_audit_log_user_id_fkey",
    }).onDelete("set null"),
    index("discord_link_audit_user_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("discord_link_audit_created_at_idx").on(table.createdAt),
    // Answers "who has tried to claim this Discord account", which is the
    // question an organizer chasing a duplicate actually has.
    index("discord_link_audit_discord_user_id_idx").on(table.discordUserId),
    pgPolicy("discord_link_audit_select_organizer", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer,
    }),
  ],
).enableRLS();

export type DiscordAccount = typeof discordAccounts.$inferSelect;
export type DiscordLinkAuditEntry = typeof discordLinkAuditLog.$inferSelect;
