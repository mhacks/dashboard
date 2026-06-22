import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./users";

// Mirrors `ApplicationStatus` in lib/types/applications.ts
export const applicationStatus = pgEnum("application_status", [
  "pending",
  "reviewed",
  "flagged",
]);

const applicationColumns = () => ({
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  status: applicationStatus("status").notNull().default("pending"),

  // Personal Information
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  ethnicity: text("ethnicity").notNull(),

  // Academic Information
  university: text("university").notNull(),
  country: text("country").notNull(),
  degree: text("degree").notNull(),
  graduationYear: integer("graduation_year").notNull(),
  previousHackathons: integer("previous_hackathons").notNull(),
  major: text("major").notNull(),
  resume: text("resume"),

  // Essays
  whatWouldYouDo: text("what_would_you_do").notNull(),
  whyMhacks: text("why_mhacks").notNull(),
  hillToDieOn: text("hill_to_die_on").notNull(),

  // Logistics
  transportationType: text("transportation_type").notNull(),
  comingFrom: text("coming_from").notNull(),
  airportCode: text("airport_code"),
  shirtSize: text("shirt_size").notNull(),
  allergiesDescription: text("allergies_description"),
  needsTravelReimbursement: boolean("needs_travel_reimbursement").notNull(),
  wouldAttendWithoutReimbursement: boolean(
    "would_attend_without_reimbursement",
  ),

  // Socials
  github: text("github"),
  linkedin: text("linkedin"),
  personalSite: text("personal_site"),

  // Communications
  followsInstagram: boolean("follows_instagram"),

  // MLH & Sponsor Agreements
  // The MLH agreement checkboxes are still required in the form, but accepting
  // them is implied by submitting — so they are not persisted as columns.
  sponsorEmails: boolean("sponsor_emails"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const hackerApplicants = pgTable("hacker_applicants", {
  ...applicationColumns(),

  // Review fields — stored inline since it's a 1-to-1 relationship
  reviewMotivation: integer("review_motivation"),
  reviewBuilderMindset: integer("review_builder_mindset"),
  reviewCollaboration: integer("review_collaboration"),
  reviewCreativity: integer("review_creativity"),
  reviewDiversity: integer("review_diversity"),
  flagForReview: boolean("flag_for_review").notNull().default(false),
  reviewNotes: text("review_notes"),
});

export const judgeApplicants = pgTable("judge_applicants", {
  ...applicationColumns(),
});

export const hackerApplicationDrafts = pgTable("hacker_application_drafts", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type HackerApplicantRow = typeof hackerApplicants.$inferSelect;
export type NewHackerApplicant = typeof hackerApplicants.$inferInsert;
export type JudgeApplicantRow = typeof judgeApplicants.$inferSelect;
export type NewJudgeApplicant = typeof judgeApplicants.$inferInsert;
export type HackerApplicationDraftRow =
  typeof hackerApplicationDrafts.$inferSelect;
