import {
  pgTable,
  pgEnum,
  pgPolicy,
  check,
  unique,
  uuid,
  text,
  smallint,
  integer,
  timestamp,
  foreignKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUid, authenticatedRole } from "drizzle-orm/supabase";
import { isOrganizer } from "./rls";
import { users } from "./users";
import "./triggers";

// Whether an award will actually be paid out. There is no undecided state: an
// award row exists only for hackers who are getting travel reimbursement, so
// the question is binary from the moment the row is written.
//   approved — the hacker is eligible for reimbursement after the hackathon.
//   denied   — the hacker is not.
export const reimbursementStatus = pgEnum("reimbursement_status", [
  "approved",
  "denied",
]);

// Travel reimbursement tiers. Amounts live here as data rather than in app
// code so adjusting a tier is an UPDATE, not a migration and a deploy — and so
// Postgres can SUM the committed budget directly.
export const reimbursementRegions = pgTable(
  "reimbursement_regions",
  {
    region: smallint().primaryKey().notNull(),
    label: text().notNull(),
    amountCents: integer("amount_cents").notNull(),
  },
  (table) => [
    check(
      "reimbursement_regions_amount_cents_check",
      sql`${table.amountCents} >= 0`,
    ),
    // No CHECK on the region range — this table *is* the set of valid regions,
    // and the foreign key below restricts awards to rows that exist here. A new
    // tier is one INSERT rather than an ALTER TABLE.
    pgPolicy("reimbursement_regions_select_authenticated", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
).enableRLS();

export const hackerReimbursements = pgTable(
  "hacker_reimbursements",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    region: smallint().notNull(),
    // Defaults to approved: an organizer writing an award row is granting it,
    // and eligibility is revoked by flipping this rather than by deleting.
    status: reimbursementStatus().default("approved").notNull(),

    // Set when an organizer finalizes the decision.
    decidedByUserId: uuid("decided_by_user_id"),
    decidedAt: timestamp("decided_at", {
      withTimezone: true,
      mode: "string",
    }),
    notes: text(),

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
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "hacker_reimbursements_user_id_fkey",
    }).onDelete("cascade"),
    // No cascade: deleting a tier that awards still point at should fail loudly
    // rather than silently delete those awards.
    foreignKey({
      columns: [table.region],
      foreignColumns: [reimbursementRegions.region],
      name: "hacker_reimbursements_region_fkey",
    }),
    // An organizer's account being removed must not erase a hacker's record.
    foreignKey({
      columns: [table.decidedByUserId],
      foreignColumns: [users.id],
      name: "hacker_reimbursements_decided_by_user_id_fkey",
    }).onDelete("set null"),
    unique("hacker_reimbursements_user_id_unique").on(table.userId),
    pgPolicy("hacker_reimbursements_select_own_or_organizer", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid} OR ${isOrganizer}`,
    }),
    pgPolicy("hacker_reimbursements_organizer_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: isOrganizer,
    }),
    pgPolicy("hacker_reimbursements_organizer_update", {
      for: "update",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
    pgPolicy("hacker_reimbursements_organizer_delete", {
      for: "delete",
      to: authenticatedRole,
      using: isOrganizer,
    }),
  ],
).enableRLS();

export type ReimbursementStatus =
  (typeof reimbursementStatus.enumValues)[number];
export type ReimbursementRegionRow = typeof reimbursementRegions.$inferSelect;
export type HackerReimbursementRow = typeof hackerReimbursements.$inferSelect;
export type NewHackerReimbursement = typeof hackerReimbursements.$inferInsert;
