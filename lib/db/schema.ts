import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Example table — replace with your own schema.
// Run `pnpm db:generate` after editing, then `pnpm db:migrate` (or `pnpm db:push`).
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
