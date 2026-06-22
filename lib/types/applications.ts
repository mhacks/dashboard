import { z } from "zod";
import { UserEntry } from "../db/schema/users";

export const baseApplicationSchema = z.object({
  // Personal Information
  age: z.number().min(18, "You must be at least 18 years old"),
  gender: z.string().min(1, "Please select an option"),
  genderOther: z.string().optional(),
  ethnicity: z.string().min(1, "Please select an option"),
  ethnicityOther: z.string().optional(),

  // Academic Information
  university: z.string().min(1, "Please select your university"),
  universityOther: z.string().optional(),
  country: z.string().min(1, "Please select your country"),
  countryOther: z.string().optional(),
  degree: z.string().min(1, "Please select your degree"),
  degreeOther: z.string().optional(),
  graduationYear: z.number().min(2026, "Graduation year must be 2026 or later"),
  previousHackathons: z.number().min(0, "Number cannot be negative"),
  major: z.string().min(1, "Please select your major"),
  majorOther: z.string().optional(),
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
    .string()
    .regex(/^[A-Z]{3}$/, "Enter a valid 3-letter IATA airport code (e.g. DTW)")
    .optional()
    .or(z.literal("")),
  shirtSize: z.string().min(1, "Please select your shirt size"),
  hasAllergies: z.boolean(),
  allergiesDescription: z.string().max(500).optional(),
  needsTravelReimbursement: z.boolean(),
  wouldAttendWithoutReimbursement: z.boolean().optional(),

  // Socials
  github: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  linkedin: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  personalSite: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),

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
