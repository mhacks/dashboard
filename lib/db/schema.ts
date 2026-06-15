import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

// Mirrors `ApplicationStatus` in lib/types/applications.ts
export const applicationStatus = pgEnum("application_status", [
  "pending",
  "reviewed",
  "flagged",
]);

// Synced from auth.users via a trigger on signup. The FK to auth.users is
// enforced in a raw SQL migration (see supabase/migrations) so drizzle-kit
// doesn't have to model the auth schema.
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // same value as auth.users.id
  email: text("email").notNull(),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ProfileRow = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

/**
 * Columns shared by both application tables. JS keys are camelCase so a
 * validated Zod payload can be inserted directly (`db.insert(...).values(data)`);
 * the DB columns are snake_case per Postgres convention.
 *
 * Keep these in sync with the Zod schemas in lib/types/applications.ts.
 */
const applicationColumns = () => ({
  id: uuid("id").primaryKey().defaultRandom(),
  // FK to profiles.id — enforced in a raw SQL migration. One application per user.
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: "cascade" }),
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

// User profile keyed by the Supabase auth user id (auth.users.id).
// Run `pnpm db:generate` after editing, then `pnpm db:migrate` (or `pnpm db:push`).
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
});
