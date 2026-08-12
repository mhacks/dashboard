import type { RsvpFormData } from "@/lib/types/rsvps";

export const RSVP_STEPS: readonly {
  label: string;
  shortLabel: string;
  fields: readonly (keyof RsvpFormData)[];
}[] = [
  {
    label: "Personal",
    shortLabel: "Personal",
    fields: [
      "legalName",
      "preferredName",
      "email",
      "emailMatchesApplication",
      "incorrectEmailRiskAcknowledged",
      "dietaryRestrictions",
      "otherDietaryRestriction",
      "tshirtSize",
    ],
  },
  {
    label: "Travel & Tax",
    shortLabel: "Travel",
    fields: [
      "travelPlan",
      "travelGuideAcknowledged",
      "flightBooked",
      "receipt",
      "receiptBindingAcknowledged",
      "streetAddress",
      "city",
      "stateOrProvince",
      "postalCode",
      "country",
    ],
  },
  {
    label: "Waivers",
    shortLabel: "Waivers",
    fields: [
      "activitiesWaiverResponse",
      "photoReleaseResponse",
      "additionalNotes",
    ],
  },
  {
    label: "Review & Submit",
    shortLabel: "Review",
    fields: [],
  },
];

export const DIETARY_OPTIONS = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "kosher", label: "Kosher" },
  { value: "halal", label: "Halal" },
  { value: "gluten-free", label: "Gluten-free" },
  { value: "none", label: "None" },
  { value: "other", label: "Other" },
] as const;

export const TSHIRT_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export const TRAVEL_OPTIONS = [
  {
    value: "umich-student",
    label: "I am a University of Michigan student.",
  },
  {
    value: "self-funded",
    label: "I will plan and finance my own travel.",
  },
  {
    value: "reimbursement",
    label: "I will apply for a travel reimbursement.",
  },
] as const;

export const TRAVEL_LABELS = Object.fromEntries(
  TRAVEL_OPTIONS.map((option) => [option.value, option.label]),
) as Record<(typeof TRAVEL_OPTIONS)[number]["value"], string>;

export const DIETARY_LABELS = Object.fromEntries(
  DIETARY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<(typeof DIETARY_OPTIONS)[number]["value"], string>;
