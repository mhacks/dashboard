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
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  phoneNumber: text("phone_number").notNull().default(""),
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
