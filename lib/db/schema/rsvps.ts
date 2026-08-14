import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
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

import {
  MAX_RSVP_RECEIPT_SIZE_BYTES,
  RSVP_RECEIPT_CONTENT_TYPES,
} from "../../rsvp/receipt";
import { hackerApplicants } from "./applications";
import { isOrganizer } from "./rls";
import { users } from "./users";

const MAX_RSVP_RECEIPT_SIZE_SQL = sql.raw(String(MAX_RSVP_RECEIPT_SIZE_BYTES));
const RSVP_RECEIPT_CONTENT_TYPES_SQL = sql.raw(
  RSVP_RECEIPT_CONTENT_TYPES.map((type) => `'${type}'`).join(", "),
);

export const rsvpTravelPlan = pgEnum("rsvp_travel_plan", [
  "local",
  "self-funded",
  "reimbursement",
]);

export const hackerRsvpDrafts = pgTable(
  "hacker_rsvp_drafts",
  {
    userId: uuid("user_id").primaryKey().notNull(),
    data: jsonb().default({}).notNull(),
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
    pgPolicy("hacker_rsvp_drafts_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
  ],
).enableRLS();

export const hackerRsvps = pgTable(
  "hacker_rsvps",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    applicationId: uuid("application_id").notNull(),

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
    stateOrProvince: text("state_or_province"),
    postalCode: text("postal_code"),
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
      "hacker_rsvps_reimbursement_consistent",
      sql`(
        ${table.travelPlan} = 'reimbursement'
        AND ${table.travelGuideAcknowledged} IS TRUE
        AND ${table.flightBooked} IS TRUE
        AND ${table.receiptBindingAcknowledged} IS TRUE
        AND ${table.receiptKey} IS NOT NULL
        AND ${table.receiptOriginalName} IS NOT NULL
        AND ${table.receiptContentType} IN (${RSVP_RECEIPT_CONTENT_TYPES_SQL})
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
