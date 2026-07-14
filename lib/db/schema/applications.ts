import {
  pgTable,
  pgEnum,
  pgPolicy,
  unique,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  foreignKey,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUid, authenticatedRole, authUsers } from "drizzle-orm/supabase";
import { isOrganizer } from "./rls";
import { users } from "./users";

export const applicationStatus = pgEnum("application_status", [
  "pending",
  "reviewed",
  "flagged",
]);

export const reviewEventType = pgEnum("review_event_type", [
  "draft_saved",
  "review_completed",
]);

export type ReviewEventChanges = Record<
  string,
  {
    from: string | number | boolean | null;
    to: string | number | boolean | null;
  }
>;

export type ReviewEventSnapshot = {
  effortRating: number | null;
  builderRating: number | null;
  flaggedForReview: boolean;
  reviewComments: string | null;
  reviewedAt: string | null;
  applicationStatus: "pending" | "reviewed" | "flagged";
};

export const hackerApplicants = pgTable(
  "hacker_applicants",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    status: applicationStatus().default("pending").notNull(),

    // Personal Information
    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),
    phoneNumber: text("phone_number").notNull().default(""),
    age: integer("age").notNull(),
    gender: text("gender").notNull(),
    ethnicity: text("ethnicity").notNull(),

    // Academic Information
    university: text().notNull(),
    country: text().notNull(),
    degree: text().notNull(),
    graduationYear: integer("graduation_year").notNull(),
    previousHackathons: integer("previous_hackathons").notNull(),
    major: text().notNull(),
    resume: text(),

    // Essays
    whatWouldYouDo: text("what_would_you_do").notNull(),
    whyMhacks: text("why_mhacks").notNull(),
    hillToDieOn: text("hill_to_die_on").notNull(),
    anythingElse: text("anything_else"),

    // Logistics
    transportationType: text("transportation_type").notNull(),
    comingFrom: text("coming_from").notNull(),
    shirtSize: text("shirt_size").notNull(),
    allergiesDescription: text("allergies_description"),
    needsTravelReimbursement: boolean("needs_travel_reimbursement").notNull(),
    wouldAttendWithoutReimbursement: boolean(
      "would_attend_without_reimbursement",
    ),
    airportCode: text("airport_code"),

    // Socials
    github: text(),
    linkedin: text(),
    personalSite: text("personal_site"),

    // Communications
    followsInstagram: boolean("follows_instagram"),

    // MLH & Sponsor Agreements
    // The MLH agreement checkboxes are still required in the form, but accepting
    // them is implied by submitting — so they are not persisted as columns.
    sponsorEmails: boolean("sponsor_emails"),

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
      name: "hacker_applicants_user_id_users_id_fk",
    }).onDelete("cascade"),
    unique("hacker_applicants_user_id_unique").on(table.userId),
    pgPolicy("hacker_applicants_select_own_or_organizer", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid} OR ${isOrganizer}`,
    }),
    pgPolicy("hacker_applicants_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("hacker_applicants_update_organizer", {
      for: "update",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
  ],
).enableRLS();

export const hackerApplicationDrafts = pgTable(
  "hacker_application_drafts",
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
      name: "hacker_application_drafts_user_id_fkey",
    }).onDelete("cascade"),
    pgPolicy("hacker_application_drafts_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("hacker_application_drafts_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("hacker_application_drafts_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("hacker_application_drafts_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
  ],
).enableRLS();

export const hackerApplicationReviews = pgTable(
  "hacker_application_reviews",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    applicationId: uuid("application_id").notNull(),
    reviewerUserId: uuid("reviewer_user_id").notNull(),
    effortRating: integer("effort_rating"),
    builderRating: integer("builder_rating"),
    flaggedForReview: boolean("flagged_for_review").default(false).notNull(),
    reviewComments: text("review_comments"),
    reviewedAt: timestamp("reviewed_at", {
      withTimezone: true,
      mode: "string",
    }),
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
      columns: [table.applicationId],
      foreignColumns: [hackerApplicants.id],
      name: "hacker_application_reviews_application_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.reviewerUserId],
      foreignColumns: [users.id],
      name: "hacker_application_reviews_reviewer_user_id_fkey",
    }).onDelete("cascade"),
    unique("hacker_application_reviews_application_id_unique").on(
      table.applicationId,
    ),
    pgPolicy("hacker_application_reviews_organizer_select", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer,
    }),
    pgPolicy("hacker_application_reviews_organizer_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: isOrganizer,
    }),
    pgPolicy("hacker_application_reviews_organizer_update", {
      for: "update",
      to: authenticatedRole,
      using: isOrganizer,
      withCheck: isOrganizer,
    }),
  ],
).enableRLS();

export const hackerApplicationReviewEvents = pgTable(
  "hacker_application_review_events",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    reviewId: uuid("review_id").notNull(),
    applicationId: uuid("application_id").notNull(),
    reviewerUserId: uuid("reviewer_user_id").notNull(),
    eventType: reviewEventType("event_type").notNull(),
    changes: jsonb().$type<ReviewEventChanges>().notNull(),
    snapshot: jsonb().$type<ReviewEventSnapshot>().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.reviewId],
      foreignColumns: [hackerApplicationReviews.id],
      name: "hacker_application_review_events_review_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.applicationId],
      foreignColumns: [hackerApplicants.id],
      name: "hacker_application_review_events_application_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.reviewerUserId],
      foreignColumns: [users.id],
      name: "hacker_application_review_events_reviewer_user_id_fkey",
    }).onDelete("cascade"),
    index("hacker_application_review_events_application_id_created_at_idx").on(
      table.applicationId,
      table.createdAt,
    ),
    pgPolicy("hacker_application_review_events_organizer_select", {
      for: "select",
      to: authenticatedRole,
      using: isOrganizer,
    }),
    pgPolicy("hacker_application_review_events_organizer_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: isOrganizer,
    }),
  ],
).enableRLS();

export type HackerApplicantRow = typeof hackerApplicants.$inferSelect;
export type NewHackerApplicant = typeof hackerApplicants.$inferInsert;
export type HackerApplicationDraftRow =
  typeof hackerApplicationDrafts.$inferSelect;
export type HackerApplicationReviewRow =
  typeof hackerApplicationReviews.$inferSelect;
export type NewHackerApplicationReview =
  typeof hackerApplicationReviews.$inferInsert;
export type HackerApplicationReviewEventRow =
  typeof hackerApplicationReviewEvents.$inferSelect;
export type NewHackerApplicationReviewEvent =
  typeof hackerApplicationReviewEvents.$inferInsert;
