import {
  pgTable,
  pgEnum,
  unique,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  foreignKey,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
import { users } from "./users";

export const applicationStatus = pgEnum("application_status", [
  "pending",
  "reviewed",
  "flagged",
]);

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
  ],
).enableRLS();

export type HackerApplicantRow = typeof hackerApplicants.$inferSelect;
export type NewHackerApplicant = typeof hackerApplicants.$inferInsert;
export type HackerApplicationDraftRow =
  typeof hackerApplicationDrafts.$inferSelect;
