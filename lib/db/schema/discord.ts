import {
  foreignKey,
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
