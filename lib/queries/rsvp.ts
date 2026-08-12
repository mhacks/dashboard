import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import {
  hackerRsvpDrafts,
  hackerRsvps,
  type HackerRsvpDraftRow,
  type HackerRsvpRow,
} from "@/lib/db/schema/rsvps";
import { processQueuedRsvpReceiptCleanup } from "@/lib/rsvp/cleanup";
import { isRsvpOpen } from "@/lib/rsvp/deadline";
import {
  applyTravelEligibilityDefaults,
  getRsvpTravelEligibility,
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
      receipt: RsvpReceiptMetadata | null;
      submittedAt: string;
    }
  | {
      kind: "editable" | "closed";
      draft: RsvpDraftData;
      receipt: RsvpReceiptMetadata | null;
      accountEmail: string;
      travelEligibility: RsvpTravelEligibility;
      draftVersion: number;
      receiptVersion: number;
    };

type ApplicantDefaultSource = Pick<
  typeof hackerApplicants.$inferSelect,
  | "firstName"
  | "lastName"
  | "shirtSize"
  | "allergiesDescription"
  | "transportationType"
  | "comingFrom"
  | "needsTravelReimbursement"
>;

const RSVP_DIETARY_VALUES = new Set<string>(DIETARY_RESTRICTION_VALUES);
const RSVP_TSHIRT_VALUES = new Set<string>(TSHIRT_SIZE_VALUES);

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
): RsvpDraftData {
  const firstName = application.firstName.trim();
  const lastName = application.lastName.trim();
  const legalName = [firstName, lastName].filter(Boolean).join(" ");
  const dietaryDefaults = draft.dietaryRestrictions?.length
    ? {}
    : applicationDietaryDefaults(application.allergiesDescription);
  const travelEligibility = getRsvpTravelEligibility(application, {
    address: draft,
  });

  return applyTravelEligibilityDefaults(
    {
      ...draft,
      legalName: draft.legalName || legalName || undefined,
      preferredName: draft.preferredName || firstName || undefined,
      email: accountEmail,
      emailMatchesApplication: true,
      incorrectEmailRiskAcknowledged: true,
      ...dietaryDefaults,
      tshirtSize:
        draft.tshirtSize ?? applicationTshirtSizeDefault(application.shirtSize),
    },
    travelEligibility,
  );
}

function receiptMetadata(
  row: Pick<
    HackerRsvpDraftRow | HackerRsvpRow,
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

export function rsvpRowToFormData(row: HackerRsvpRow): RsvpFormData {
  const receipt = receiptMetadata(row) ?? undefined;
  return rsvpFormSchema.parse({
    legalName: row.legalName,
    preferredName: row.preferredName,
    email: row.email,
    emailMatchesApplication: row.emailMatchesApplication,
    incorrectEmailRiskAcknowledged: row.incorrectEmailRiskAcknowledged,
    dietaryRestrictions: row.dietaryRestrictions,
    otherDietaryRestriction: row.otherDietaryRestriction ?? undefined,
    tshirtSize: row.tshirtSize,
    travelPlan: row.travelPlan,
    travelGuideAcknowledged: row.travelGuideAcknowledged ?? undefined,
    flightBooked: row.flightBooked ?? undefined,
    receipt,
    receiptBindingAcknowledged: row.receiptBindingAcknowledged ?? undefined,
    streetAddress: row.streetAddress,
    city: row.city,
    stateOrProvince: row.stateOrProvince,
    postalCode: row.postalCode,
    country: row.country,
    activitiesWaiverResponse: row.activitiesWaiverResponse,
    photoReleaseResponse: row.photoReleaseResponse,
    additionalNotes: row.additionalNotes ?? "",
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
  await processQueuedRsvpReceiptCleanup(userId);
  const [row] = await db
    .select({
      applicationId: hackerApplicants.id,
      applicationFirstName: hackerApplicants.firstName,
      applicationLastName: hackerApplicants.lastName,
      applicationShirtSize: hackerApplicants.shirtSize,
      applicationAllergiesDescription: hackerApplicants.allergiesDescription,
      applicationTransportationType: hackerApplicants.transportationType,
      applicationComingFrom: hackerApplicants.comingFrom,
      applicationNeedsTravelReimbursement:
        hackerApplicants.needsTravelReimbursement,
      final: hackerRsvps,
      draft: hackerRsvpDrafts,
    })
    .from(hackerApplicants)
    .leftJoin(hackerRsvps, eq(hackerRsvps.applicationId, hackerApplicants.id))
    .leftJoin(
      hackerRsvpDrafts,
      eq(hackerRsvpDrafts.userId, hackerApplicants.userId),
    )
    .where(eq(hackerApplicants.userId, userId))
    .limit(1);

  if (!row) return { kind: "not-eligible" };

  if (row.final) {
    return {
      kind: "submitted",
      values: rsvpRowToFormData(row.final),
      receipt: receiptMetadata(row.final),
      submittedAt: row.final.submittedAt,
    };
  }

  const parsedDraft = rsvpDraftSchema.safeParse(row.draft?.data ?? {});
  const draft = applyApplicantDefaults(
    parsedDraft.success ? parsedDraft.data : {},
    {
      firstName: row.applicationFirstName,
      lastName: row.applicationLastName,
      shirtSize: row.applicationShirtSize,
      allergiesDescription: row.applicationAllergiesDescription,
      transportationType: row.applicationTransportationType,
      comingFrom: row.applicationComingFrom,
      needsTravelReimbursement: row.applicationNeedsTravelReimbursement,
    },
    accountEmail,
  );
  const receipt = row.draft ? receiptMetadata(row.draft) : null;
  if (receipt) draft.receipt = receipt;

  return {
    kind: isRsvpOpen(nowMs) ? "editable" : "closed",
    draft,
    receipt,
    accountEmail,
    travelEligibility: getRsvpTravelEligibility(
      {
        transportationType: row.applicationTransportationType,
        comingFrom: row.applicationComingFrom,
        needsTravelReimbursement: row.applicationNeedsTravelReimbursement,
      },
      { address: draft },
    ),
    draftVersion: row.draft?.dataVersion ?? 0,
    receiptVersion: row.draft?.receiptVersion ?? 0,
  };
}
