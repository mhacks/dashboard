import {
  foreignKey,
  index,
  integer,
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
// Only the bot writes here, as service_role through the discord_* RPCs in
// 20260925*_discord_rpcs.sql. authenticated gets read access to its own row and
// organizers to all, nothing more.
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

export type DiscordAccount = typeof discordAccounts.$inferSelect;

// The bot's pending email verification codes, one per Discord account; issuing
// a new code replaces the old one. Only a SHA-256 of the code is stored, bound
// to the Discord account it was sent for. email is kept so verification can
// re-check eligibility through discord_lookup_member at the moment of linking.
//
// No policies: RLS denies anon and authenticated everything, and the bot works
// through the definer RPCs in 20260925*_discord_verification_rpcs.sql.
export const discordVerificationCodes = pgTable(
  "discord_verification_codes",
  {
    discordUserId: text("discord_user_id").primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    email: text().notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer().default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "discord_verification_codes_user_id_fkey",
    }).onDelete("cascade"),
  ],
).enableRLS();

// One row per code emailed, used only to rate limit sends per Discord account
// and per inbox. discord_issue_code prunes rows older than a day.
export const discordVerificationSends = pgTable(
  "discord_verification_sends",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    discordUserId: text("discord_user_id").notNull(),
    email: text().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("discord_verification_sends_discord_user_id_sent_at_idx").on(
      table.discordUserId,
      table.sentAt,
    ),
    index("discord_verification_sends_email_sent_at_idx").on(
      table.email,
      table.sentAt,
    ),
    index("discord_verification_sends_sent_at_idx").on(table.sentAt),
  ],
).enableRLS();
