import {
  pgEnum,
  pgPolicy,
  pgTable,
  unique,
  uuid,
  text,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUid, authenticatedRole } from "drizzle-orm/supabase";
import { isOrganizer } from "./rls";
import { teams } from "./reservation";

export const userRole = pgEnum("user_role", [
  "hacker",
  "organizer",
  "admin",
  "volunteer",
  "judge",
]);
export type UserRole = (typeof userRole.enumValues)[number];

export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().notNull(),
    email: text().notNull(),
    role: userRole().default("hacker").notNull(),
    teamId: uuid("team_id").references(() => teams.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    unique("users_email_unique").on(table.email),
    pgPolicy("users_select_own_or_organizer", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.id} = ${authUid} OR ${isOrganizer}`,
    }),
  ],
).enableRLS();

export type UserEntry = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
