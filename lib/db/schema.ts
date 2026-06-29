import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// User profile keyed by the Supabase auth user id (auth.users.id).
// Run `pnpm db:generate` after editing, then `pnpm db:migrate` (or `pnpm db:push`).
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  isAdmin: boolean("is_admin").notNull().default(false),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  location: text("location"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tables = pgTable(
  "tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    reservedByTeamId: uuid("reserved_by_team_id").references(() => teams.id, {
      onDelete: "set null",
    }),
    reservedAt: timestamp("reserved_at", { withTimezone: true }),
  },
  (t) => [
    unique("tables_event_number_unique").on(t.eventId, t.number),
    uniqueIndex("tables_event_team_unique").on(t.eventId, t.reservedByTeamId),
  ],
);
