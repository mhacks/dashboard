import type { ReviewApplicationSummary } from "@/lib/types/application-reviews";

export const ALL_FILTER_VALUE = "all";

export type ReviewFilterOption = {
  value: string;
  label: string;
  match: (application: ReviewApplicationSummary) => boolean;
};

export type ReviewFilterDef = {
  key: string;
  label: string;
  // The first option is always the ALL_FILTER_VALUE passthrough.
  options: readonly ReviewFilterOption[];
};

// The applicant answered a US state or the literal "international" for
// `comingFrom`, and `country` is a separate question — the two can disagree, so
// this is deliberately a union. For triage a false positive costs a glance;
// missing someone who needs a visa costs a lot more.
function isInternational(application: ReviewApplicationSummary) {
  return (
    application.comingFrom === "international" || application.country !== "us"
  );
}

// `wouldAttendWithoutReimbursement` is only asked when reimbursement is needed,
// so null means "never answered" and must not be conflated with an explicit
// "no" — every predicate below compares against false strictly.
const FILTER_DEFS = [
  {
    key: "reimbursement",
    label: "Travel reimbursement",
    options: [
      { value: ALL_FILTER_VALUE, label: "Any", match: () => true },
      {
        value: "needs",
        label: "Needs reimbursement",
        match: (application) => application.needsTravelReimbursement,
      },
      {
        value: "at-risk",
        label: "Won't attend without it",
        match: (application) =>
          application.wouldAttendWithoutReimbursement === false,
      },
      {
        value: "hide-at-risk",
        label: "Hide won't-attend",
        match: (application) =>
          application.wouldAttendWithoutReimbursement !== false,
      },
      {
        value: "none",
        label: "No reimbursement needed",
        match: (application) => !application.needsTravelReimbursement,
      },
    ],
  },
  {
    key: "origin",
    label: "Traveling from",
    options: [
      { value: ALL_FILTER_VALUE, label: "Anywhere", match: () => true },
      {
        value: "international",
        label: "International",
        match: isInternational,
      },
      {
        value: "domestic",
        label: "Domestic (US)",
        match: (application) => !isInternational(application),
      },
    ],
  },
] as const satisfies readonly ReviewFilterDef[];

export const REVIEW_FILTERS: readonly ReviewFilterDef[] = FILTER_DEFS;

export type ReviewFilterKey = (typeof FILTER_DEFS)[number]["key"];
export type ReviewFilterState = Record<ReviewFilterKey, string>;

export const DEFAULT_REVIEW_FILTERS = Object.fromEntries(
  FILTER_DEFS.map((def) => [def.key, ALL_FILTER_VALUE]),
) as ReviewFilterState;

export function selectedFilterValue(filters: ReviewFilterState, key: string) {
  return filters[key as ReviewFilterKey] ?? ALL_FILTER_VALUE;
}

function selectedOption(def: ReviewFilterDef, filters: ReviewFilterState) {
  const selected = selectedFilterValue(filters, def.key);
  if (selected === ALL_FILTER_VALUE) return null;
  return def.options.find((option) => option.value === selected) ?? null;
}

export function matchesReviewFilters(
  application: ReviewApplicationSummary,
  filters: ReviewFilterState,
) {
  // Filters compose by AND, so "won't attend without it" + "international"
  // narrows to exactly that population. An unrecognized selection falls through
  // as no filter rather than matching nothing, so a stale value can never
  // silently blank the whole list.
  return REVIEW_FILTERS.every(
    (def) => selectedOption(def, filters)?.match(application) ?? true,
  );
}

export function countActiveReviewFilters(filters: ReviewFilterState) {
  return REVIEW_FILTERS.filter((def) => selectedOption(def, filters)).length;
}

// Ordered by the registry rather than by object key order, which is not
// guaranteed stable across state updates.
export function reviewFilterSignature(filters: ReviewFilterState) {
  return REVIEW_FILTERS.map((def) =>
    selectedFilterValue(filters, def.key),
  ).join("|");
}
