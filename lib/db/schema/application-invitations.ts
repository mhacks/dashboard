import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

import { isOrganizer } from "./rls";
import { users } from "./users";

/**
 * Email-first invitations for hackers who need to apply after the public
 * deadline. The target may not have an account yet, so access is resolved by
 * matching this normalized email to the authenticated user's account.
 */
export const hackerApplicationInvitations = pgTable(
  "hacker_application_invitations",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    email: text().notNull(),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    note: text(),
    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("hacker_application_invitations_email_unique").on(table.email),
    check(
      "hacker_application_invitations_email_normalized",
      sql`${table.email} = lower(btrim(${table.email}))`,
    ),
    index("hacker_application_invitations_expires_at_idx").on(table.expiresAt),
    pgPolicy("hacker_application_invitations_organizer_select", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer,
    }),
    pgPolicy("hacker_application_invitations_organizer_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: isOrganizer,
    }),
    pgPolicy("hacker_application_invitations_organizer_update", {
      for: "update",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
  ],
).enableRLS();

export type HackerApplicationInvitationRow =
  typeof hackerApplicationInvitations.$inferSelect;
