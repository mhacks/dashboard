import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUid, authenticatedRole } from "drizzle-orm/supabase";
import { isOrganizer } from "./rls";
import { users } from "./users";

/*
  Puzzle hunt, stage one: a hacker finds an organizer on /find-my-organizer
  and asks for a code. The organizer generates one on /admin/hunt-codes; the
  hacker enters it to unlock the first puzzle.

  Each code is six digits, single use, and expires a few minutes after it is
  made, so a code passed to a friend works for at most one of them. Codes are
  stored as typed: with a million possible values a hash would be reversed
  instantly, and redemption is rate limited instead.

  Only unredeemed codes need to be unique, since that is what a hacker types
  to find one. The generate action deletes expired, unredeemed codes before
  inserting, so old codes don't crowd the space.
*/
export const huntCodes = pgTable(
  "hunt_codes",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizerId: uuid("organizer_id").notNull(),
    code: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    redeemedBy: uuid("redeemed_by"),
    redeemedAt: timestamp("redeemed_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    uniqueIndex("hunt_codes_open_code_key")
      .on(table.code)
      .where(sql`${table.redeemedBy} is null`),
    index("hunt_codes_organizer_created_idx").on(
      table.organizerId,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.organizerId],
      foreignColumns: [users.id],
      name: "hunt_codes_organizer_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.redeemedBy],
      foreignColumns: [users.id],
      name: "hunt_codes_redeemed_by_fkey",
    }).onDelete("set null"),
    pgPolicy("hunt_codes_organizer_select", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer,
    }),
  ],
).enableRLS();

/*
  One row per hacker who has unlocked the hunt, so they can come back to the
  puzzle without asking for another code. Later stages add columns here.

  `flower` is the flower the hacker hunts for (an id from lib/hunt/flowers.ts),
  picked at random when they redeem an organizer's code. Rows from before it
  existed get one the first time it is needed.

  Each wrong flower clicked adds to `petal_misses` and locks petals until
  `petal_locked_until`, so clicking every flower is slower than solving the
  riddle.

  `petal_code` is the final code: made at random the first time the hacker
  clicks a petal of their assigned flower on the main page, and shown to them
  again on every later click. Random rather than derived from the user ID, so
  reading the source doesn't let anyone compute their own.
*/
export const huntProgress = pgTable(
  "hunt_progress",
  {
    userId: uuid("user_id").primaryKey().notNull(),
    /** The code that unlocked it; kept if that code row is ever deleted. */
    codeId: uuid("code_id"),
    unlockedAt: timestamp("unlocked_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    flower: text(),
    petalMisses: integer("petal_misses").default(0).notNull(),
    petalLockedUntil: timestamp("petal_locked_until", {
      withTimezone: true,
      mode: "string",
    }),
    petalCode: text("petal_code"),
    petalFoundAt: timestamp("petal_found_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    unique("hunt_progress_petal_code_unique").on(table.petalCode),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "hunt_progress_user_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.codeId],
      foreignColumns: [huntCodes.id],
      name: "hunt_progress_code_id_fkey",
    }).onDelete("set null"),
    pgPolicy("hunt_progress_select_own_or_organizer", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid} OR ${isOrganizer}`,
    }),
  ],
).enableRLS();

export type HuntCodeRow = typeof huntCodes.$inferSelect;
