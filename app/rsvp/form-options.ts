import {
  dietaryOptions as applicationDietaryOptions,
  shirtSizeOptions as applicationShirtSizeOptions,
} from "@/app/apply/form-options";
import type { RsvpFormData } from "@/lib/types/rsvps";

export const RSVP_STEPS: readonly {
  id: "personal" | "travel" | "waivers" | "review";
  label: string;
  shortLabel: string;
  fields: readonly (keyof RsvpFormData)[];
}[] = [
  {
    id: "personal",
    label: "Personal",
    shortLabel: "Personal",
    fields: [
      "firstName",
      "lastName",
      "email",
      "dietaryRestrictions",
      "otherDietaryRestriction",
      "tshirtSize",
      "streetAddress",
      "city",
      "stateOrProvince",
      "postalCode",
      "country",
    ],
  },
  {
    id: "travel",
    label: "Travel",
    shortLabel: "Travel",
    fields: [
      "travelPlan",
      "travelGuideAcknowledged",
      "flightBooked",
      "receipt",
      "receiptBindingAcknowledged",
    ],
  },
  {
    id: "waivers",
    label: "Waivers",
    shortLabel: "Waivers",
    fields: [
      "activitiesWaiverResponse",
      "photoReleaseResponse",
      "additionalNotes",
    ],
  },
  {
    id: "review",
    label: "Review & Submit",
    shortLabel: "Review",
    fields: [],
  },
];

export type RsvpStep = (typeof RSVP_STEPS)[number];

export function getRsvpSteps(showTravelStep: boolean): readonly RsvpStep[] {
  return showTravelStep
    ? RSVP_STEPS
    : RSVP_STEPS.filter((step) => step.id !== "travel");
}

const APPLICATION_DIETARY_OPTIONS = applicationDietaryOptions as readonly {
  value: Exclude<RsvpFormData["dietaryRestrictions"][number], "none">;
  label: string;
}[];
const APPLICATION_OTHER_DIETARY_OPTION = APPLICATION_DIETARY_OPTIONS.find(
  (option) => option.value === "other",
);

export const DIETARY_OPTIONS = [
  ...APPLICATION_DIETARY_OPTIONS.filter((option) => option.value !== "other"),
  { value: "none", label: "None" },
  ...(APPLICATION_OTHER_DIETARY_OPTION
    ? [APPLICATION_OTHER_DIETARY_OPTION]
    : []),
] as const;

export const TSHIRT_OPTIONS = applicationShirtSizeOptions.map(
  (option) => option.label,
) as readonly RsvpFormData["tshirtSize"][];

export const TRAVEL_OPTIONS = [
  {
    value: "local",
    label: "I am local to the Ann Arbor region.",
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
