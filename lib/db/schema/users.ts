import { pgEnum, pgTable, unique, uuid, text } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["hacker", "organizer"]);
export type UserRole = (typeof userRole.enumValues)[number];

export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().notNull(),
    email: text().notNull(),
    role: userRole().default("hacker").notNull(),
  },
  (table) => [unique("users_email_unique").on(table.email)],
);

export type UserEntry = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
