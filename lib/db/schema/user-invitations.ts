import { pgTable, pgPolicy, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { and, gt, isNull, sql } from "drizzle-orm";
import { authenticatedRole } from "drizzle-orm/supabase";
import { isOrganizer } from "./rls";
import { userRole, users } from "./users";

export const userInvitations = pgTable(
  "user_invitations",
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    email: text().notNull(),
    role: userRole().notNull(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("user_invitations_email_lower_idx").on(sql`lower(${table.email})`),
    index("user_invitations_created_at_idx").on(table.createdAt),
    pgPolicy("user_invitations_organizer_select", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer,
    }),
    pgPolicy("user_invitations_organizer_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: isOrganizer,
    }),
    pgPolicy("user_invitations_organizer_update", {
      for: "update",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
  ],
).enableRLS();

export function pendingInviteForEmail(normalizedEmail: string) {
  return and(
    sql`lower(${userInvitations.email}) = ${normalizedEmail}`,
    isNull(userInvitations.acceptedAt),
    isNull(userInvitations.revokedAt),
    gt(userInvitations.expiresAt, new Date()),
  );
}
