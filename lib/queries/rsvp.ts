import { and, eq } from "drizzle-orm";

import { decisionOutcome } from "@/lib/decisions";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import {
  hackerReimbursements,
  reimbursementRegions,
} from "@/lib/db/schema/reimbursements";
import {
  hackerRsvpDrafts,
  hackerRsvps,
  type HackerRsvpRow,
} from "@/lib/db/schema/rsvps";
import { isRsvpOpen } from "@/lib/rsvp/deadline";
import {
  applyTravelEligibilityDefaults,
  getRsvpTravelEligibility,
  hasApprovedTravelAward,
  type RsvpTravelEligibility,
} from "@/lib/rsvp/travel-eligibility";
import {
  DIETARY_RESTRICTION_VALUES,
  TSHIRT_SIZE_VALUES,
  rsvpDraftSchema,
  rsvpFormSchema,
  rsvpReceiptMetadataSchema,
  type RsvpDraftData,
  type RsvpFormData,
  type RsvpReceiptMetadata,
} from "@/lib/types/rsvps";

export type AttendeeRsvpState =
  | { kind: "not-eligible" }
  | {
      kind: "submitted";
      values: RsvpFormData;
      submittedAt: string;
      /** Approved travel award in cents, or null when none. */
      reimbursementCents: number | null;
    }
  | {
      kind: "editable" | "closed";
      draft: RsvpDraftData;
      accountEmail: string;
      travelEligibility: RsvpTravelEligibility;
      draftVersion: number;
      /** Approved travel award in cents, or null when none. */
      reimbursementCents: number | null;
    };

/** Matches the decision letter: only positive awards are shown to applicants. */
function awardedReimbursementCents(
  cents: number | null | undefined,
): number | null {
  return hasApprovedTravelAward(cents) ? cents! : null;
}

function travelEligibilitySource(
  application: Pick<
    ApplicantDefaultSource,
    "transportationType" | "comingFrom" | "needsTravelReimbursement"
  >,
  reimbursementCents: number | null | undefined,
) {
  return {
    transportationType: application.transportationType,
    comingFrom: application.comingFrom,
    needsTravelReimbursement: application.needsTravelReimbursement,
    hasTravelAward: hasApprovedTravelAward(reimbursementCents),
  };
}

type ApplicantDefaultSource = Pick<
  typeof hackerApplicants.$inferSelect,
  | "firstName"
  | "lastName"
  | "phoneNumber"
  | "shirtSize"
  | "allergiesDescription"
  | "transportationType"
  | "comingFrom"
  | "needsTravelReimbursement"
>;

const RSVP_DIETARY_VALUES = new Set<string>(DIETARY_RESTRICTION_VALUES);
const RSVP_TSHIRT_VALUES = new Set<string>(TSHIRT_SIZE_VALUES);

function applicationRsvpDefaults(
  application: ApplicantDefaultSource,
  accountEmail: string,
): RsvpDraftData {
  const firstName = application.firstName.trim();
  const lastName = application.lastName.trim();

  const phoneNumber = application.phoneNumber.trim();

  return {
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    phoneNumber: phoneNumber || undefined,
    email: accountEmail,
    ...applicationDietaryDefaults(application.allergiesDescription),
    tshirtSize: applicationTshirtSizeDefault(application.shirtSize),
  };
}

function applicationDietaryDefaults(
  allergiesDescription: string | null,
): Pick<RsvpDraftData, "dietaryRestrictions" | "otherDietaryRestriction"> {
  const trimmed = allergiesDescription?.trim() ?? "";
  const normalized = trimmed.toLowerCase();

  if (!normalized || ["none", "no", "n/a", "na"].includes(normalized)) {
    return { dietaryRestrictions: ["none"] };
  }

  const canonical = normalized.replace(/\s+/g, "-");
  if (RSVP_DIETARY_VALUES.has(canonical) && canonical !== "other") {
    return {
      dietaryRestrictions: [
        canonical as Exclude<
          (typeof DIETARY_RESTRICTION_VALUES)[number],
          "none" | "other"
        >,
      ],
    };
  }

  return {
    dietaryRestrictions: ["other"],
    otherDietaryRestriction: trimmed,
  };
}

function applicationTshirtSizeDefault(
  shirtSize: string,
): RsvpDraftData["tshirtSize"] {
  const normalized = shirtSize.trim().toUpperCase();
  return RSVP_TSHIRT_VALUES.has(normalized)
    ? (normalized as RsvpDraftData["tshirtSize"])
    : undefined;
}

function applyApplicantDefaults(
  draft: RsvpDraftData,
  application: ApplicantDefaultSource,
  accountEmail: string,
  reimbursementCents: number | null | undefined,
): RsvpDraftData {
  const applicationDefaults = applicationRsvpDefaults(
    application,
    accountEmail,
  );
  const dietaryDefaults = draft.dietaryRestrictions?.length
    ? {}
    : applicationDietaryDefaults(application.allergiesDescription);
  const travelEligibility = getRsvpTravelEligibility(
    travelEligibilitySource(application, reimbursementCents),
    {
      address: draft,
    },
  );

  return applyTravelEligibilityDefaults(
    {
      ...applicationDefaults,
      ...draft,
      email: accountEmail,
      firstName: draft.firstName || applicationDefaults.firstName,
      lastName: draft.lastName || applicationDefaults.lastName,
      phoneNumber: draft.phoneNumber || applicationDefaults.phoneNumber,
      ...dietaryDefaults,
      tshirtSize: draft.tshirtSize ?? applicationDefaults.tshirtSize,
    },
    travelEligibility,
  );
}

function receiptMetadata(
  row: Pick<
    HackerRsvpRow,
    "receiptOriginalName" | "receiptContentType" | "receiptSizeBytes"
  >,
): RsvpReceiptMetadata | null {
  const parsed = rsvpReceiptMetadataSchema.safeParse({
    originalName: row.receiptOriginalName,
    contentType: row.receiptContentType,
    sizeBytes: row.receiptSizeBytes,
  });
  return parsed.success ? parsed.data : null;
}

export function rsvpRowToFormData(
  row: HackerRsvpRow,
  application: ApplicantDefaultSource,
  accountEmail: string,
): RsvpFormData {
  const receipt = receiptMetadata(row) ?? undefined;
  return rsvpFormSchema.parse({
    ...applicationRsvpDefaults(application, accountEmail),
    email: accountEmail,
    travelPlan: row.travelPlan,
    travelGuideAcknowledged: row.travelGuideAcknowledged ?? undefined,
    flightBooked: row.flightBooked ?? undefined,
    receipt,
    receiptBindingAcknowledged: row.receiptBindingAcknowledged ?? undefined,
    streetAddress: row.streetAddress,
    city: row.city,
    stateOrProvince: row.stateOrProvince ?? undefined,
    postalCode: row.postalCode ?? undefined,
    country: row.country,
    activitiesWaiverResponse: row.activitiesWaiverResponse,
    photoReleaseResponse: row.photoReleaseResponse,
    additionalNotes: row.additionalNotes ?? undefined,
  });
}

export async function getAttendeeRsvpState({
  userId,
  accountEmail,
  nowMs = Date.now(),
}: {
  userId: string;
  accountEmail: string;
  nowMs?: number;
}): Promise<AttendeeRsvpState> {
  const [row] = await db
    .select({
      applicationId: hackerApplicants.id,
      applicationDecision: hackerApplicants.decision,
      applicationFirstName: hackerApplicants.firstName,
      applicationLastName: hackerApplicants.lastName,
      applicationPhoneNumber: hackerApplicants.phoneNumber,
      applicationShirtSize: hackerApplicants.shirtSize,
      applicationAllergiesDescription: hackerApplicants.allergiesDescription,
      applicationTransportationType: hackerApplicants.transportationType,
      applicationComingFrom: hackerApplicants.comingFrom,
      applicationNeedsTravelReimbursement:
        hackerApplicants.needsTravelReimbursement,
      reimbursementCents: reimbursementRegions.amountCents,
      final: hackerRsvps,
      draft: hackerRsvpDrafts,
    })
    .from(hackerApplicants)
    .leftJoin(hackerRsvps, eq(hackerRsvps.applicationId, hackerApplicants.id))
    .leftJoin(
      hackerRsvpDrafts,
      eq(hackerRsvpDrafts.userId, hackerApplicants.userId),
    )
    .leftJoin(
      hackerReimbursements,
      and(
        eq(hackerReimbursements.userId, hackerApplicants.userId),
        eq(hackerReimbursements.status, "approved"),
      ),
    )
    .leftJoin(
      reimbursementRegions,
      eq(reimbursementRegions.region, hackerReimbursements.region),
    )
    .where(eq(hackerApplicants.userId, userId))
    .limit(1);

  if (!row) return { kind: "not-eligible" };
  if (decisionOutcome(row.applicationDecision) !== "accepted") {
    return { kind: "not-eligible" };
  }

  const reimbursementCents = awardedReimbursementCents(row.reimbursementCents);

  if (row.final) {
    return {
      kind: "submitted",
      values: rsvpRowToFormData(
        row.final,
        {
          firstName: row.applicationFirstName,
          lastName: row.applicationLastName,
          phoneNumber: row.applicationPhoneNumber,
          shirtSize: row.applicationShirtSize,
          allergiesDescription: row.applicationAllergiesDescription,
          transportationType: row.applicationTransportationType,
          comingFrom: row.applicationComingFrom,
          needsTravelReimbursement: row.applicationNeedsTravelReimbursement,
        },
        accountEmail,
      ),
      submittedAt: row.final.submittedAt,
      reimbursementCents,
    };
  }

  const parsedDraft = rsvpDraftSchema.safeParse(row.draft?.data ?? {});
  const draft = applyApplicantDefaults(
    parsedDraft.success ? parsedDraft.data : {},
    {
      firstName: row.applicationFirstName,
      lastName: row.applicationLastName,
      phoneNumber: row.applicationPhoneNumber,
      shirtSize: row.applicationShirtSize,
      allergiesDescription: row.applicationAllergiesDescription,
      transportationType: row.applicationTransportationType,
      comingFrom: row.applicationComingFrom,
      needsTravelReimbursement: row.applicationNeedsTravelReimbursement,
    },
    accountEmail,
    row.reimbursementCents,
  );

  return {
    kind: isRsvpOpen(nowMs) ? "editable" : "closed",
    draft,
    accountEmail,
    travelEligibility: getRsvpTravelEligibility(
      travelEligibilitySource(
        {
          transportationType: row.applicationTransportationType,
          comingFrom: row.applicationComingFrom,
          needsTravelReimbursement: row.applicationNeedsTravelReimbursement,
        },
        row.reimbursementCents,
      ),
      { address: draft },
    ),
    draftVersion: 0,
    reimbursementCents,
  };
}
