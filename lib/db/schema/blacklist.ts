import {
  pgTable,
  pgPolicy,
  uniqueIndex,
  check,
  uuid,
  text,
  timestamp,
  foreignKey,
} from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { authenticatedRole } from "drizzle-orm/supabase";
import { isOrganizer } from "./rls";
import { users } from "./users";
import "./triggers";

// Normalization is defined once and used in two places: the stored generated
// columns below, and the lookup in lib/actions/blacklist.actions.ts. Routing
// both through the same helper is what keeps a blacklist entry and an incoming
// application from being normalized differently — a drift that would silently
// let blocked applicants through.
//
// POSIX classes rather than \s / \d: drizzle's `sql` is a tagged template, and
// an invalid escape sequence in a tagged template makes the cooked string
// undefined.
export function normalizedBlacklistName(expr: SQL): SQL {
  return sql`nullif(lower(regexp_replace(btrim(${expr}), '[[:space:]]+', ' ', 'g')), '')`;
}

export function normalizedBlacklistPhone(expr: SQL): SQL {
  return sql`nullif(regexp_replace(${expr}, '[^0-9+]', '', 'g'), '')`;
}

// Organizer-curated deny list. An application is rejected when its full name
// OR its phone number matches an entry — either field alone is enough, so a
// single row can block by name, by phone, or by both.
export const blacklist = pgTable(
  "blacklist",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),

    // Both identifiers are optional so an organizer can enter only what they
    // actually know. Requiring both would force placeholder values into the
    // other column, and under OR matching a placeholder name would block every
    // real applicant who happens to share it.
    fullName: text("full_name"),
    fullNameNormalized: text("full_name_normalized").generatedAlwaysAs(
      (): SQL => normalizedBlacklistName(sql.raw(`"full_name"`)),
    ),
    phoneNumber: text("phone_number"),
    phoneNumberNormalized: text("phone_number_normalized").generatedAlwaysAs(
      (): SQL => normalizedBlacklistPhone(sql.raw(`"phone_number"`)),
    ),

    reason: text(),
    createdByUserId: uuid("created_by_user_id"),

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
    // An organizer's account being removed must not drop the entry itself.
    foreignKey({
      columns: [table.createdByUserId],
      foreignColumns: [users.id],
      name: "blacklist_created_by_user_id_fkey",
    }).onDelete("set null"),
    check(
      "blacklist_identifier_present_check",
      sql`${table.fullName} is not null or ${table.phoneNumber} is not null`,
    ),
    // Partial uniques double as the lookup indexes for the match query.
    uniqueIndex("blacklist_full_name_normalized_key")
      .on(table.fullNameNormalized)
      .where(sql`${table.fullNameNormalized} is not null`),
    uniqueIndex("blacklist_phone_number_normalized_key")
      .on(table.phoneNumberNormalized)
      .where(sql`${table.phoneNumberNormalized} is not null`),
    // Organizer-only across the board — an applicant must never be able to
    // read the deny list, so there is deliberately no select-own policy.
    pgPolicy("blacklist_organizer_select", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer,
    }),
    pgPolicy("blacklist_organizer_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: isOrganizer,
    }),
    pgPolicy("blacklist_organizer_update", {
      for: "update",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
    pgPolicy("blacklist_organizer_delete", {
      for: "delete",
      to: authenticatedRole,
      using: isOrganizer,
    }),
  ],
).enableRLS();

export type BlacklistRow = typeof blacklist.$inferSelect;
export type NewBlacklistEntry = typeof blacklist.$inferInsert;
