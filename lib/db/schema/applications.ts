import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
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
  genderOther: text("gender_other"),
  ethnicity: text("ethnicity").notNull(),
  ethnicityOther: text("ethnicity_other"),

  // Academic Information
  university: text("university").notNull(),
  universityOther: text("university_other"),
  country: text("country").notNull(),
  countryOther: text("country_other"),
  degree: text("degree").notNull(),
  degreeOther: text("degree_other"),
  graduationYear: integer("graduation_year").notNull(),
  previousHackathons: integer("previous_hackathons").notNull(),
  major: text("major").notNull(),
  majorOther: text("major_other"),
  resume: text("resume"),

  // Essays
  whyAttend: text("why_attend").notNull(),
  technicalChallenge: text("technical_challenge").notNull(),
  proudProject: text("proud_project").notNull(),
  anythingElse: text("anything_else"),

  // Logistics
  transportationType: text("transportation_type").notNull(),
  comingFrom: text("coming_from").notNull(),
  airportCode: text("airport_code"),
  shirtSize: text("shirt_size").notNull(),
  hasAllergies: boolean("has_allergies").notNull(),
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
  mlhCodeOfConduct: boolean("mlh_code_of_conduct").notNull(),
  mlhPrivacyPolicy: boolean("mlh_privacy_policy").notNull(),
  mlhEmails: boolean("mlh_emails").notNull(),
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

export type HackerApplicantRow = typeof hackerApplicants.$inferSelect;
export type NewHackerApplicant = typeof hackerApplicants.$inferInsert;
export type JudgeApplicantRow = typeof judgeApplicants.$inferSelect;
export type NewJudgeApplicant = typeof judgeApplicants.$inferInsert;
