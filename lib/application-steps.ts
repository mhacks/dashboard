// The apply wizard's step definitions. Kept in their own module — free of React
// and of any database import — so the form and the dashboard read the same
// source. The dashboard derives draft progress from these, and a step added to
// the wizard without updating the dashboard would otherwise silently skew it.

import type { HackerApplicationFormData } from "@/lib/types/applications";

export const APPLICATION_STEPS: Array<{
  label: string;
  fields: (keyof HackerApplicationFormData)[];
}> = [
  {
    label: "Personal",
    fields: [
      "firstName",
      "lastName",
      "phoneNumber",
      "age",
      "gender",
      "ethnicity",
    ],
  },
  {
    label: "Academic",
    fields: [
      "university",
      "country",
      "degree",
      "graduationYear",
      "previousHackathons",
      "major",
      "resume",
    ],
  },
  {
    label: "Essays",
    fields: ["whatWouldYouDo", "whyMhacks", "hillToDieOn"],
  },
  {
    label: "Logistics",
    fields: ["transportationType", "comingFrom", "shirtSize"],
  },
  { label: "Socials", fields: [] },
  {
    label: "Agreements",
    fields: ["mlhCodeOfConduct", "mlhPrivacyPolicy", "mlhEmails", "notAiSlop"],
  },
];

/**
 * Whether a draft value counts as answered.
 *
 * Deliberately not a truthiness check: `previousHackathons: 0` is a real answer
 * and must count, while an unticked agreement (`false`) and the empty strings
 * the form seeds every field with must not.
 */
function isAnswered(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (value === "" || value === false) return false;
  return true;
}

/**
 * How many wizard steps a saved draft has fully filled in.
 *
 * "Socials" carries no required fields, so it is vacuously complete and always
 * counts — which keeps this total on the same scale as the wizard's own
 * `{step + 1} / {APPLICATION_STEPS.length}` counter rather than inventing a
 * second, conflicting notion of progress.
 */
export function completedStepCount(draft: Record<string, unknown>): number {
  return APPLICATION_STEPS.filter((step) =>
    step.fields.every((field) => isAnswered(draft[field])),
  ).length;
}

/**
 * Whether the applicant has actually put anything into a draft.
 *
 * Not derivable from `completedStepCount`: the field-less "Socials" step is
 * vacuously complete, so even an untouched draft scores 1. And `/apply` writes
 * an empty draft row the moment the page is opened, so the row's existence
 * means nothing either — only a filled field does.
 */
export function isDraftStarted(draft: Record<string, unknown>): boolean {
  return APPLICATION_STEPS.some((step) =>
    step.fields.some((field) => isAnswered(draft[field])),
  );
}
