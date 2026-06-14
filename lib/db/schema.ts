import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

// Mirrors `ApplicationStatus` in lib/schemas/application.ts
export const applicationStatus = pgEnum("application_status", [
  "pending",
  "reviewed",
  "flagged",
]);

/**
 * Columns shared by both application tables. JS keys are camelCase so a
 * validated Zod payload can be inserted directly (`db.insert(...).values(data)`);
 * the DB columns are snake_case per Postgres convention.
 *
 * Keep these in sync with the Zod schemas in lib/schemas/application.ts.
 */
const applicationColumns = () => ({
  id: uuid("id").primaryKey().defaultRandom(),
  // FK to Supabase auth.users(id) — enforced in a follow-up migration to avoid
  // modelling the auth schema here. One application per user.
  userId: uuid("user_id").notNull().unique(),
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
});

export const judgeApplicants = pgTable("judge_applicants", {
  ...applicationColumns(),
});

export type HackerApplicantRow = typeof hackerApplicants.$inferSelect;
export type NewHackerApplicant = typeof hackerApplicants.$inferInsert;
export type JudgeApplicantRow = typeof judgeApplicants.$inferSelect;
export type NewJudgeApplicant = typeof judgeApplicants.$inferInsert;
