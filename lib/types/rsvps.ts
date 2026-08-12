import { z } from "zod";

import {
  MAX_RSVP_RECEIPT_SIZE_BYTES,
  RSVP_RECEIPT_CONTENT_TYPES,
} from "@/lib/rsvp/receipt";

export const DIETARY_RESTRICTION_VALUES = [
  "vegetarian",
  "vegan",
  "kosher",
  "halal",
  "gluten-free",
  "none",
  "other",
] as const;

export const TSHIRT_SIZE_VALUES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export const TRAVEL_PLAN_VALUES = [
  "umich-student",
  "self-funded",
  "reimbursement",
] as const;

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

const draftText = (max: number) => z.string().trim().max(max);

const requiredYes = (message: string) =>
  z.boolean().refine((value) => value, message);

export const rsvpReceiptMetadataSchema = z.strictObject({
  originalName: requiredText("Receipt filename", 255),
  contentType: z.enum(RSVP_RECEIPT_CONTENT_TYPES),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_RSVP_RECEIPT_SIZE_BYTES, "Receipt exceeds the 10MB limit"),
});

export type RsvpReceiptMetadata = z.infer<typeof rsvpReceiptMetadataSchema>;

const finalFields = {
  legalName: requiredText("Full legal name", 200),
  preferredName: requiredText("Preferred name", 100),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(320, "Email address is too long"),
  emailMatchesApplication: requiredYes(
    "Please confirm this is the email used for your application",
  ),
  incorrectEmailRiskAcknowledged: requiredYes(
    "Please acknowledge the risk of entering the wrong email",
  ),
  dietaryRestrictions: z
    .array(z.enum(DIETARY_RESTRICTION_VALUES))
    .min(1, "Select at least one dietary option")
    .max(DIETARY_RESTRICTION_VALUES.length),
  otherDietaryRestriction: z.string().trim().max(500).optional(),
  tshirtSize: z.enum(TSHIRT_SIZE_VALUES, {
    error: "Please select a T-shirt size",
  }),
  travelPlan: z.enum(TRAVEL_PLAN_VALUES, {
    error: "Please select a travel plan",
  }),
  travelGuideAcknowledged: z.boolean().optional(),
  flightBooked: z.boolean().optional(),
  receipt: rsvpReceiptMetadataSchema.optional(),
  receiptBindingAcknowledged: z.boolean().optional(),
  streetAddress: requiredText("Street address", 200),
  city: requiredText("City", 100),
  stateOrProvince: requiredText("State or province", 100),
  postalCode: requiredText("ZIP or postal code", 32),
  country: requiredText("Country", 100),
  activitiesWaiverResponse: z.boolean({
    error: "Please answer the Activities Waiver question",
  }),
  photoReleaseResponse: z.boolean({
    error: "Please answer the Photo Release question",
  }),
  additionalNotes: z.string().trim().max(2_000).optional(),
};

const conditionalKeys = [
  "travelGuideAcknowledged",
  "flightBooked",
  "receipt",
  "receiptBindingAcknowledged",
] as const;

function normalizeConditionalFields<
  T extends {
    travelPlan?: string;
    dietaryRestrictions?: readonly string[];
    otherDietaryRestriction?: string;
    travelGuideAcknowledged?: boolean;
    flightBooked?: boolean;
    receipt?: RsvpReceiptMetadata;
    receiptBindingAcknowledged?: boolean;
  },
>(value: T): T {
  const normalized = { ...value };
  if (normalized.travelPlan !== "reimbursement") {
    for (const key of conditionalKeys) delete normalized[key];
  }

  if (
    !Array.isArray(normalized.dietaryRestrictions) ||
    !normalized.dietaryRestrictions.includes("other")
  ) {
    delete normalized.otherDietaryRestriction;
  }

  return normalized;
}

type DietaryData = {
  dietaryRestrictions?: readonly string[];
  otherDietaryRestriction?: string;
};

function validateDietarySelections(
  data: DietaryData,
  ctx: z.RefinementCtx,
  requireOtherDetails: boolean,
): void {
  const restrictions = data.dietaryRestrictions;
  if (!restrictions) return;

  if (new Set(restrictions).size !== restrictions.length) {
    ctx.addIssue({
      code: "custom",
      path: ["dietaryRestrictions"],
      message: "Dietary options cannot be selected more than once",
    });
  }
  if (restrictions.includes("none") && restrictions.length > 1) {
    ctx.addIssue({
      code: "custom",
      path: ["dietaryRestrictions"],
      message: "None cannot be combined with another dietary option",
    });
  }
  if (
    requireOtherDetails &&
    restrictions.includes("other") &&
    !data.otherDietaryRestriction?.trim()
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["otherDietaryRestriction"],
      message: "Please describe your other dietary restriction",
    });
  }
}

const finalRsvpObjectSchema = z
  .strictObject(finalFields)
  .superRefine((data, ctx) => {
    validateDietarySelections(data, ctx, true);

    if (data.travelPlan !== "reimbursement") return;

    const requiredConfirmations = [
      ["travelGuideAcknowledged", data.travelGuideAcknowledged],
      ["flightBooked", data.flightBooked],
      ["receiptBindingAcknowledged", data.receiptBindingAcknowledged],
    ] as const;
    for (const [field, value] of requiredConfirmations) {
      if (value !== true) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Please confirm Yes",
        });
      }
    }
    if (!data.receipt) {
      ctx.addIssue({
        code: "custom",
        path: ["receipt"],
        message: "Please upload a travel reimbursement receipt",
      });
    }
  })
  .transform(normalizeConditionalFields);

export const rsvpFormSchema = finalRsvpObjectSchema;

export type RsvpFormData = z.infer<typeof rsvpFormSchema>;

const draftFields = {
  legalName: draftText(200).optional(),
  preferredName: draftText(100).optional(),
  email: draftText(320).optional(),
  emailMatchesApplication: z.boolean().optional(),
  incorrectEmailRiskAcknowledged: z.boolean().optional(),
  dietaryRestrictions: z
    .array(z.enum(DIETARY_RESTRICTION_VALUES))
    .max(DIETARY_RESTRICTION_VALUES.length)
    .optional(),
  otherDietaryRestriction: draftText(500).optional(),
  tshirtSize: z.enum(TSHIRT_SIZE_VALUES).optional(),
  travelPlan: z.enum(TRAVEL_PLAN_VALUES).optional(),
  travelGuideAcknowledged: z.boolean().optional(),
  flightBooked: z.boolean().optional(),
  receipt: rsvpReceiptMetadataSchema.optional(),
  receiptBindingAcknowledged: z.boolean().optional(),
  streetAddress: draftText(200).optional(),
  city: draftText(100).optional(),
  stateOrProvince: draftText(100).optional(),
  postalCode: draftText(32).optional(),
  country: draftText(100).optional(),
  activitiesWaiverResponse: z.boolean().optional(),
  photoReleaseResponse: z.boolean().optional(),
  additionalNotes: draftText(2_000).optional(),
};

const draftRsvpObjectSchema = z
  .strictObject(draftFields)
  .superRefine((data, ctx) => validateDietarySelections(data, ctx, false))
  .transform(normalizeConditionalFields);

export const rsvpDraftSchema = draftRsvpObjectSchema;

export type RsvpDraftData = z.infer<typeof rsvpDraftSchema>;
