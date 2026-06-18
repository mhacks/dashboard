import { pgTable, uuid, text } from "drizzle-orm/pg-core";

export type UserRole = "hacker" | "organizer";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("hacker").$type<UserRole>(),
});

export type UserEntry = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
