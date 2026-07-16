import {
  comingFromOptions,
  countries,
  degreeOptions,
  ethnicityOptions,
  majorOptions,
  shirtSizeOptions,
  transportationOptions,
} from "@/app/apply/form-options";

type ApplicationStatus = "pending" | "reviewed" | "flagged";

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const OPTION_LABELS = new Map(
  [
    ...GENDER_OPTIONS,
    ...ethnicityOptions,
    ...countries,
    ...degreeOptions,
    ...majorOptions,
    ...comingFromOptions,
    ...transportationOptions,
    ...shirtSizeOptions,
  ].map((option) => [option.value, option.label]),
);

export function applicationStatusLabel(status: ApplicationStatus) {
  if (status === "reviewed") return "Reviewed";
  if (status === "flagged") return "Flagged";
  return "Pending";
}

function resolveDisplayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const stringValue = String(value);
  return OPTION_LABELS.get(stringValue) ?? stringValue;
}

export function formatReviewDisplayValue(value: unknown) {
  return resolveDisplayValue(value) ?? "Not provided";
}

export function formatReviewEventValue(value: unknown, compact = false) {
  const displayValue = resolveDisplayValue(value);
  if (!displayValue) return "Empty";

  const limit = compact ? 24 : 40;
  if (displayValue.length > limit) {
    return `${displayValue.slice(0, limit)}…`;
  }

  return displayValue;
}
