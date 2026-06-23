import { z } from "zod";
import { UserEntry } from "../db/schema/users";

export const baseApplicationSchema = z.object({
  // Personal Information
  age: z
    .number({ error: "Please enter your age" })
    .int("Age must be a whole number")
    .min(18, "You must be at least 18 years old")
    .max(120, "Please enter a valid age"),
  gender: z.string().min(1, "Please select an option"),
  ethnicity: z.string().min(1, "Please select an option"),

  // Academic Information
  university: z.string().min(1, "Please select your university"),
  country: z.string().min(1, "Please select your country"),
  degree: z.string().min(1, "Please select your degree"),
  graduationYear: z
    .number({ error: "Please select your graduation year" })
    .min(2026, "Graduation year must be 2026 or later"),
  previousHackathons: z
    .number({ error: "Please enter a number (0 if none)" })
    .int("Please enter a whole number")
    .min(0, "Number cannot be negative")
    .max(100, "Please enter a reasonable number of hackathons"),
  major: z.string().min(1, "Please select your major"),
  resume: z.string().min(1, "Please upload your resume"),

  // Essays
  whatWouldYouDo: z
    .string()
    .min(1, "Required")
    .max(600, "Please limit your response to 600 characters")
    .refine(
      (s) => s.trim().split(/\s+/).filter(Boolean).length >= 10,
      "Please write at least 10 words",
    )
    .refine(
      (s) => s.trim().split(/\s+/).filter(Boolean).length <= 100,
      "Please limit your response to 100 words",
    ),
  whyMhacks: z
    .string()
    .min(1, "Required")
    .max(1200, "Please limit your response to 1200 characters")
    .refine(
      (s) => s.trim().split(/\s+/).filter(Boolean).length >= 20,
      "Please write at least 20 words",
    )
    .refine(
      (s) => s.trim().split(/\s+/).filter(Boolean).length <= 200,
      "Please limit your response to 200 words",
    ),
  hillToDieOn: z
    .string()
    .min(1, "Required")
    .max(80, "Please limit your response to 80 characters")
    .refine(
      (s) => s.trim().split(/\s+/).filter(Boolean).length >= 3,
      "Please write at least 3 words",
    )
    .refine(
      (s) => s.trim().split(/\s+/).filter(Boolean).length <= 10,
      "Please limit your response to 10 words",
    ),

  // Logistics
  transportationType: z.string().min(1, "Please select transportation type"),
  comingFrom: z.string().min(1, "Please enter your location"),
  airportCode: z
    .union([
      z
        .string()
        .regex(
          /^[A-Z]{3}$/,
          "Enter a valid 3-letter IATA airport code (e.g. DTW)",
        ),
      z.literal(""),
    ])
    .optional(),
  shirtSize: z.string().min(1, "Please select your shirt size"),
  // A non-empty description implies the applicant has allergies/restrictions.
  allergiesDescription: z.string().max(500).optional(),
  needsTravelReimbursement: z.boolean(),
  wouldAttendWithoutReimbursement: z.boolean().optional(),

  // Socials
  github: z
    .union([z.string().url("Please enter a valid URL"), z.literal("")])
    .optional(),
  linkedin: z
    .union([z.string().url("Please enter a valid URL"), z.literal("")])
    .optional(),
  personalSite: z
    .union([z.string().url("Please enter a valid URL"), z.literal("")])
    .optional(),

  // Communications
  followsInstagram: z.boolean().optional(),

  // MLH & Sponsor Agreements
  mlhCodeOfConduct: z
    .boolean()
    .refine((val) => val === true, "You must agree to the MLH Code of Conduct"),
  mlhPrivacyPolicy: z
    .boolean()
    .refine(
      (val) => val === true,
      "You must agree to share your information with MLH",
    ),
  mlhEmails: z
    .boolean()
    .refine((val) => val === true, "You must agree to receive emails from MLH"),
  sponsorEmails: z.boolean().optional(),
});

export const hackerApplicationSchema = baseApplicationSchema;
export type HackerApplicationFormData = z.infer<typeof hackerApplicationSchema>;

export type ApplicationStatus = "pending" | "reviewed" | "flagged";

export type HackerApplicant = HackerApplicationFormData & {
  id: string;
  userId: string;
  status: ApplicationStatus;
  user: UserEntry;
};

export const judgeApplicationSchema = baseApplicationSchema;
export type JudgeApplicationFormData = z.infer<typeof judgeApplicationSchema>;

export type JudgeApplicant = JudgeApplicationFormData & {
  id: string;
  userId: string;
  status: ApplicationStatus;
  user: UserEntry;
};
