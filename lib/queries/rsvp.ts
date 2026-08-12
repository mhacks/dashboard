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
      draftVersion: number;
      receiptVersion: number;
    };

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
  const draft: RsvpDraftData = parsedDraft.success ? parsedDraft.data : {};
  const receipt = row.draft ? receiptMetadata(row.draft) : null;
  if (receipt) draft.receipt = receipt;

  return {
    kind: isRsvpOpen(nowMs) ? "editable" : "closed",
    draft,
    receipt,
    accountEmail,
    draftVersion: row.draft?.dataVersion ?? 0,
    receiptVersion: row.draft?.receiptVersion ?? 0,
  };
}
