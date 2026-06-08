import { pgTable, uuid, text } from "drizzle-orm/pg-core";

// User profile keyed by the Supabase auth user id (auth.users.id).
// Run `pnpm db:generate` after editing, then `pnpm db:migrate` (or `pnpm db:push`).
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
});
