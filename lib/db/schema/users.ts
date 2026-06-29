import { pgTable, uuid, text, boolean } from "drizzle-orm/pg-core";
import { teams } from "./reservation.ts";

export type UserRole = "hacker" | "organizer";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("hacker").$type<UserRole>(),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  isAdmin: boolean("is_admin").notNull().default(false),
});

export type UserEntry = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
