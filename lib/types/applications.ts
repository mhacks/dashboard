import { z } from "zod";

export const hackerApplicationSchema = z.object({
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
  resume: z.string().optional(), // Will store file info

  // Essays
  whyAttend: z
    .string()
    .min(100, "Please write at least 100 characters")
    .max(1000, "Please limit your response to 1000 characters"),
  technicalChallenge: z
    .string()
    .min(100, "Please write at least 100 characters")
    .max(1000, "Please limit your response to 1000 characters"),
  proudProject: z
    .string()
    .min(100, "Please write at least 100 characters")
    .max(1000, "Please limit your response to 1000 characters"),
  anythingElse: z
    .string()
    .max(1000, "Please limit your response to 1000 characters")
    .optional(),

  // Logistics
  transportationType: z.string().min(1, "Please select transportation type"),
  comingFrom: z.string().min(1, "Please enter your location"),
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
export type HackerApplicationFormData = z.infer<typeof hackerApplicationSchema>;

export type ApplicationStatus = "pending" | "reviewed" | "flagged";

// TODO CHANGE THIS UP
export const judgeApplicationSchema = z.object({
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
  resume: z.string().optional(), // Will store file info

  // Essays
  whyAttend: z
    .string()
    .min(100, "Please write at least 100 characters")
    .max(1000, "Please limit your response to 1000 characters"),
  technicalChallenge: z
    .string()
    .min(100, "Please write at least 100 characters")
    .max(1000, "Please limit your response to 1000 characters"),
  proudProject: z
    .string()
    .min(100, "Please write at least 100 characters")
    .max(1000, "Please limit your response to 1000 characters"),
  anythingElse: z
    .string()
    .max(1000, "Please limit your response to 1000 characters")
    .optional(),

  // Logistics
  transportationType: z.string().min(1, "Please select transportation type"),
  comingFrom: z.string().min(1, "Please enter your location"),
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

export type JudgeApplicationFormData = z.infer<typeof judgeApplicationSchema>;

export type JudgeApplicant = JudgeApplicationFormData & {
  id: string;
  user_id: string;
};
