import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { authUid, authenticatedRole, authUsers } from "drizzle-orm/supabase";

import { MAX_RSVP_RECEIPT_SIZE_BYTES } from "../../rsvp/receipt";
import { hackerApplicants } from "./applications";
import { isOrganizer } from "./rls";
import { users } from "./users";

const MAX_RSVP_RECEIPT_SIZE_SQL = sql.raw(String(MAX_RSVP_RECEIPT_SIZE_BYTES));

export const rsvpTshirtSize = pgEnum("rsvp_tshirt_size", [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
]);

export const rsvpTravelPlan = pgEnum("rsvp_travel_plan", [
  "umich-student",
  "self-funded",
  "reimbursement",
]);

export const hackerRsvpDrafts = pgTable(
  "hacker_rsvp_drafts",
  {
    userId: uuid("user_id").primaryKey().notNull(),
    data: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
    dataVersion: integer("data_version").default(0).notNull(),
    receiptKey: text("receipt_key"),
    receiptOriginalName: text("receipt_original_name"),
    receiptContentType: text("receipt_content_type"),
    receiptSizeBytes: integer("receipt_size_bytes"),
    receiptVersion: integer("receipt_version").default(0).notNull(),
    pendingReceiptUploadId: text("pending_receipt_upload_id"),
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
      foreignColumns: [authUsers.id],
      name: "hacker_rsvp_drafts_user_id_fkey",
    }).onDelete("cascade"),
    check(
      "hacker_rsvp_drafts_receipt_metadata_complete",
      sql`(
        ${table.receiptKey} IS NULL
        AND ${table.receiptOriginalName} IS NULL
        AND ${table.receiptContentType} IS NULL
        AND ${table.receiptSizeBytes} IS NULL
      ) OR (
        ${table.receiptKey} IS NOT NULL
        AND ${table.receiptOriginalName} IS NOT NULL
        AND ${table.receiptContentType} IS NOT NULL
        AND ${table.receiptContentType} IN ('application/pdf', 'image/png', 'image/jpeg')
        AND ${table.receiptSizeBytes} IS NOT NULL
        AND ${table.receiptSizeBytes} BETWEEN 1 AND ${MAX_RSVP_RECEIPT_SIZE_SQL}
      )`,
    ),
    check(
      "hacker_rsvp_drafts_versions_nonnegative",
      sql`${table.dataVersion} >= 0 AND ${table.receiptVersion} >= 0`,
    ),
    pgPolicy("hacker_rsvp_drafts_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
  ],
).enableRLS();

export const rsvpReceiptCleanup = pgTable(
  "rsvp_receipt_cleanup",
  {
    key: text().primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    attempts: integer().default(0).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    lastAttemptAt: timestamp("last_attempt_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [authUsers.id],
      name: "rsvp_receipt_cleanup_user_id_fkey",
    }).onDelete("cascade"),
    index("rsvp_receipt_cleanup_user_id_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
    check(
      "rsvp_receipt_cleanup_attempts_nonnegative",
      sql`${table.attempts} >= 0`,
    ),
  ],
).enableRLS();

export const hackerRsvps = pgTable(
  "hacker_rsvps",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    applicationId: uuid("application_id").notNull(),

    legalName: text("legal_name").notNull(),
    preferredName: text("preferred_name").notNull(),
    email: text().notNull(),
    emailMatchesApplication: boolean("email_matches_application").notNull(),
    incorrectEmailRiskAcknowledged: boolean(
      "incorrect_email_risk_acknowledged",
    ).notNull(),
    dietaryRestrictions: text("dietary_restrictions").array().notNull(),
    otherDietaryRestriction: text("other_dietary_restriction"),
    tshirtSize: rsvpTshirtSize("tshirt_size").notNull(),

    travelPlan: rsvpTravelPlan("travel_plan").notNull(),
    travelGuideAcknowledged: boolean("travel_guide_acknowledged"),
    flightBooked: boolean("flight_booked"),
    receiptKey: text("receipt_key"),
    receiptOriginalName: text("receipt_original_name"),
    receiptContentType: text("receipt_content_type"),
    receiptSizeBytes: integer("receipt_size_bytes"),
    receiptBindingAcknowledged: boolean("receipt_binding_acknowledged"),

    streetAddress: text("street_address").notNull(),
    city: text().notNull(),
    stateOrProvince: text("state_or_province").notNull(),
    postalCode: text("postal_code").notNull(),
    country: text().notNull(),

    activitiesWaiverResponse: boolean("activities_waiver_response").notNull(),
    photoReleaseResponse: boolean("photo_release_response").notNull(),
    additionalNotes: text("additional_notes"),
    submittedAt: timestamp("submitted_at", {
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
      name: "hacker_rsvps_user_id_users_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.applicationId],
      foreignColumns: [hackerApplicants.id],
      name: "hacker_rsvps_application_id_hacker_applicants_id_fk",
    }).onDelete("cascade"),
    unique("hacker_rsvps_user_id_unique").on(table.userId),
    unique("hacker_rsvps_application_id_unique").on(table.applicationId),
    check(
      "hacker_rsvps_email_acknowledgements",
      sql`${table.emailMatchesApplication} IS TRUE AND ${table.incorrectEmailRiskAcknowledged} IS TRUE`,
    ),
    check(
      "hacker_rsvps_dietary_values",
      sql`cardinality(${table.dietaryRestrictions}) > 0
        AND ${table.dietaryRestrictions} <@ ARRAY[
          'vegetarian', 'vegan', 'kosher', 'halal', 'gluten-free', 'nut-free', 'dairy-free', 'none', 'other'
        ]::text[]`,
    ),
    check(
      "hacker_rsvps_dietary_none_exclusive",
      sql`NOT (
        'none' = ANY(${table.dietaryRestrictions})
        AND cardinality(${table.dietaryRestrictions}) > 1
      )`,
    ),
    check(
      "hacker_rsvps_dietary_other_consistent",
      sql`(
        'other' = ANY(${table.dietaryRestrictions})
        AND NULLIF(BTRIM(${table.otherDietaryRestriction}), '') IS NOT NULL
      ) OR (
        NOT ('other' = ANY(${table.dietaryRestrictions}))
        AND ${table.otherDietaryRestriction} IS NULL
      )`,
    ),
    check(
      "hacker_rsvps_reimbursement_consistent",
      sql`(
        ${table.travelPlan} = 'reimbursement'
        AND ${table.travelGuideAcknowledged} IS TRUE
        AND ${table.flightBooked} IS TRUE
        AND ${table.receiptBindingAcknowledged} IS TRUE
        AND ${table.receiptKey} IS NOT NULL
        AND ${table.receiptOriginalName} IS NOT NULL
        AND ${table.receiptContentType} IS NOT NULL
        AND ${table.receiptContentType} IN ('application/pdf', 'image/png', 'image/jpeg')
        AND ${table.receiptSizeBytes} IS NOT NULL
        AND ${table.receiptSizeBytes} BETWEEN 1 AND ${MAX_RSVP_RECEIPT_SIZE_SQL}
      ) OR (
        ${table.travelPlan} <> 'reimbursement'
        AND ${table.travelGuideAcknowledged} IS NULL
        AND ${table.flightBooked} IS NULL
        AND ${table.receiptBindingAcknowledged} IS NULL
        AND ${table.receiptKey} IS NULL
        AND ${table.receiptOriginalName} IS NULL
        AND ${table.receiptContentType} IS NULL
        AND ${table.receiptSizeBytes} IS NULL
      )`,
    ),
    pgPolicy("hacker_rsvps_select_own_or_organizer", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid} OR ${isOrganizer}`,
    }),
  ],
).enableRLS();

export type HackerRsvpDraftRow = typeof hackerRsvpDrafts.$inferSelect;
export type HackerRsvpRow = typeof hackerRsvps.$inferSelect;
export type NewHackerRsvp = typeof hackerRsvps.$inferInsert;
export type RsvpReceiptCleanupRow = typeof rsvpReceiptCleanup.$inferSelect;
