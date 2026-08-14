import type { RsvpDraftData, RsvpFormData } from "@/lib/types/rsvps";

export type RsvpTravelEligibility = {
  showTravelStep: boolean;
  canRequestReimbursement: boolean;
  nonLocalCanRequestReimbursement: boolean;
  defaultTravelPlan: RsvpFormData["travelPlan"];
};

export type RsvpTravelEligibilitySource = {
  transportationType: string;
  comingFrom: string;
  needsTravelReimbursement: boolean;
};

export type RsvpAddressSource = {
  streetAddress?: string | null;
  city?: string | null;
  stateOrProvince?: string | null;
  country?: string | null;
};

const ANN_ARBOR_REGION_TERMS = [
  "ann arbor",
  "annarbor",
  "ypsilanti",
  "ypsi",
  "washtenaw",
  "saline",
  "dexter",
  "chelsea",
  "pittsfield",
  "scio",
];

function normalizedLocation(value: string) {
  return value.trim().toLowerCase().replace(/[-_]+/g, " ");
}

export function isAnnArborRegionApplicant({
  transportationType,
  comingFrom,
}: Pick<RsvpTravelEligibilitySource, "transportationType" | "comingFrom">) {
  if (transportationType === "local") return true;

  const location = normalizedLocation(comingFrom);
  return ANN_ARBOR_REGION_TERMS.some((term) => location.includes(term));
}

export function isAnnArborRegionAddress({
  streetAddress,
  city,
  stateOrProvince,
  country,
}: RsvpAddressSource) {
  const normalizedCountry = normalizedLocation(country ?? "");
  if (normalizedCountry && normalizedCountry !== "united states") return false;

  const normalizedState = normalizedLocation(stateOrProvince ?? "");
  if (
    normalizedState &&
    normalizedState !== "michigan" &&
    normalizedState !== "mi"
  ) {
    return false;
  }

  const location = normalizedLocation(
    [streetAddress, city].filter(Boolean).join(" "),
  );
  return ANN_ARBOR_REGION_TERMS.some((term) => location.includes(term));
}

export function hasRsvpAddressTravelSignal({
  streetAddress,
  city,
  stateOrProvince,
  country,
}: RsvpAddressSource) {
  const normalizedCountry = normalizedLocation(country ?? "");
  const normalizedState = normalizedLocation(stateOrProvince ?? "");
  const location = normalizedLocation(
    [streetAddress, city].filter(Boolean).join(" "),
  );

  if (normalizedCountry && normalizedCountry !== "united states") return true;
  if (
    normalizedCountry === "united states" &&
    normalizedState &&
    normalizedState !== "michigan" &&
    normalizedState !== "mi"
  ) {
    return true;
  }
  if (ANN_ARBOR_REGION_TERMS.some((term) => location.includes(term))) {
    return true;
  }
  return (
    normalizedCountry === "united states" &&
    (normalizedState === "michigan" || normalizedState === "mi") &&
    !!normalizedLocation(city ?? "")
  );
}

export function getRsvpTravelEligibility(
  source: RsvpTravelEligibilitySource,
  options: { address?: RsvpAddressSource } = {},
): RsvpTravelEligibility {
  const addressHasTravelSignal = options.address
    ? hasRsvpAddressTravelSignal(options.address)
    : false;
  const isLocal = addressHasTravelSignal
    ? isAnnArborRegionAddress(options.address ?? {})
    : isAnnArborRegionApplicant(source);

  return {
    showTravelStep: !isLocal,
    canRequestReimbursement: !isLocal && source.needsTravelReimbursement,
    nonLocalCanRequestReimbursement: source.needsTravelReimbursement,
    defaultTravelPlan: isLocal
      ? "local"
      : source.needsTravelReimbursement
        ? "reimbursement"
        : "self-funded",
  };
}

export function applyTravelEligibilityDefaults<T extends RsvpDraftData>(
  data: T,
  eligibility: RsvpTravelEligibility,
): T {
  const normalized = { ...data };

  if (!eligibility.showTravelStep) {
    normalized.travelPlan = "local";
  } else if (
    !eligibility.canRequestReimbursement &&
    (!normalized.travelPlan || normalized.travelPlan === "reimbursement")
  ) {
    normalized.travelPlan = "self-funded";
  } else if (!normalized.travelPlan) {
    normalized.travelPlan = eligibility.defaultTravelPlan;
  }

  if (normalized.travelPlan !== "reimbursement") {
    delete normalized.travelGuideAcknowledged;
    delete normalized.flightBooked;
    delete normalized.receipt;
    delete normalized.receiptBindingAcknowledged;
  }

  return normalized;
}

export function assertReceiptUploadAllowed(eligibility: RsvpTravelEligibility) {
  if (!eligibility.canRequestReimbursement) {
    throw new Error(
      "Travel reimbursement receipts are only available if you requested travel reimbursement on your application.",
    );
  }
}
