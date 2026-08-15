"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth/guards";
import type { ApplicationDecision } from "@/lib/decisions";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import {
  hackerReimbursements,
  reimbursementRegions,
} from "@/lib/db/schema/reimbursements";
import {
  hackerRsvpDrafts,
  hackerRsvps,
  type HackerRsvpDraftRow,
} from "@/lib/db/schema/rsvps";
import {
  assertAcceptedRsvpDecision,
  lockWritableRsvpApplicant,
} from "@/lib/rsvp/access";
import { assertRsvpOpen } from "@/lib/rsvp/deadline";
import { receiptKeyForUser } from "@/lib/rsvp/receipt";
import { deleteRsvpReceipt, validateRsvpReceiptInS3 } from "@/lib/rsvp/storage";
import {
  applyTravelEligibilityDefaults,
  getRsvpTravelEligibility,
  hasApprovedTravelAward,
  type RsvpTravelEligibility,
} from "@/lib/rsvp/travel-eligibility";
import {
  rsvpDraftSchema,
  rsvpFormSchema,
  rsvpReceiptMetadataSchema,
  type RsvpDraftData,
  type RsvpFormData,
} from "@/lib/types/rsvps";

const saveDraftInputSchema = z.strictObject({
  data: z.unknown(),
  expectedVersion: z.number().int().nonnegative(),
});

const saveDraftWithoutReceiptInputSchema = z.strictObject({
  data: z.unknown(),
  expectedVersion: z.number().int().nonnegative(),
});

const submitRsvpInputSchema = z.strictObject({
  data: z.unknown(),
});

export type RsvpSubmitResult = {
  alreadySubmitted: boolean;
  submittedAt: string;
};

type DraftReceipt = Pick<HackerRsvpDraftRow, "userId" | "data">;

function receiptFromDraft(draft: DraftReceipt | null | undefined) {
  if (!draft) return null;
  const parsed = rsvpReceiptMetadataSchema.safeParse(
    (draft.data as Record<string, unknown>).receipt,
  );
  if (!parsed.success) return null;

  return {
    key: receiptKeyForUser(draft.userId),
    ...parsed.data,
  };
}

function receiptMatches(
  left: ReturnType<typeof receiptFromDraft>,
  right: ReturnType<typeof receiptFromDraft>,
): boolean {
  if (!left || !right) return left === right;
  return (
    left.key === right.key &&
    left.originalName === right.originalName &&
    left.contentType === right.contentType &&
    left.sizeBytes === right.sizeBytes
  );
}

function withSessionIdentity(data: unknown, accountEmail: string) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  return {
    ...data,
    email: accountEmail,
  };
}

function withSessionAndTravelDefaults(
  data: unknown,
  accountEmail: string,
  travelEligibility: RsvpTravelEligibility,
) {
  const identityData = withSessionIdentity(data, accountEmail);
  if (
    !identityData ||
    typeof identityData !== "object" ||
    Array.isArray(identityData)
  ) {
    return identityData;
  }
  return applyTravelEligibilityDefaults(
    identityData as RsvpDraftData,
    travelEligibility,
  );
}

function requestedReimbursement(data: unknown) {
  return (
    !!data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    "travelPlan" in data &&
    data.travelPlan === "reimbursement"
  );
}

function rsvpedDecision(decision: ApplicationDecision): ApplicationDecision {
  if (decision === "early_accepted" || decision === "early_rsvped") {
    return "early_rsvped";
  }
  if (decision === "regular_accepted" || decision === "regular_rsvped") {
    return "regular_rsvped";
  }
  assertAcceptedRsvpDecision(decision);
  return decision;
}

function applicationAllergiesDescription(data: RsvpFormData): string | null {
  if (data.dietaryRestrictions.includes("none")) return null;

  const values: string[] = data.dietaryRestrictions.filter(
    (restriction) => restriction !== "other",
  );
  if (data.dietaryRestrictions.includes("other")) {
    const other = data.otherDietaryRestriction?.trim();
    if (other) values.push(other);
  }
  return values.length ? values.join(", ") : null;
}

export async function saveRsvpDraft(
  input: unknown,
): Promise<{ updatedAt: string; version: number }> {
  const user = await requireSessionUser();
  assertRsvpOpen();
  const request = saveDraftInputSchema.parse(input);
  const updatedAt = new Date().toISOString();

  const nextVersion = await db.transaction(async (tx) => {
    const application = await lockWritableRsvpApplicant(tx, user.id);
    const travelEligibility = getRsvpTravelEligibility(application, {
      address:
        request.data && typeof request.data === "object"
          ? (request.data as RsvpDraftData)
          : undefined,
    });
    const parsed = rsvpDraftSchema.parse(
      withSessionAndTravelDefaults(request.data, user.email, travelEligibility),
    );
    const data = { ...parsed } as Record<string, unknown>;
    delete data.receipt;

    if (parsed.travelPlan === "reimbursement") {
      const [draft] = await tx
        .select({
          userId: hackerRsvpDrafts.userId,
          data: hackerRsvpDrafts.data,
        })
        .from(hackerRsvpDrafts)
        .where(eq(hackerRsvpDrafts.userId, user.id))
        .limit(1);
      const receipt = receiptFromDraft(draft);
      if (receipt) {
        data.receipt = {
          originalName: receipt.originalName,
          contentType: receipt.contentType,
          sizeBytes: receipt.sizeBytes,
        };
      }
    }

    await tx
      .insert(hackerRsvpDrafts)
      .values({
        userId: user.id,
        data,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: hackerRsvpDrafts.userId,
        set: {
          data,
          updatedAt,
        },
      });

    return request.expectedVersion + 1;
  });

  return { updatedAt, version: nextVersion };
}

export async function saveRsvpDraftWithoutReceipt(input: unknown): Promise<{
  updatedAt: string;
  version: number;
}> {
  const user = await requireSessionUser();
  assertRsvpOpen();
  const request = saveDraftWithoutReceiptInputSchema.parse(input);
  const updatedAt = new Date().toISOString();

  const result = await db.transaction(async (tx) => {
    const application = await lockWritableRsvpApplicant(tx, user.id);
    const travelEligibility = getRsvpTravelEligibility(application, {
      address:
        request.data && typeof request.data === "object"
          ? (request.data as RsvpDraftData)
          : undefined,
    });
    const parsed = rsvpDraftSchema.parse(
      withSessionAndTravelDefaults(request.data, user.email, travelEligibility),
    );
    if (!parsed.travelPlan || parsed.travelPlan === "reimbursement") {
      throw new Error("Choose a non-reimbursement travel plan");
    }
    const data = { ...parsed } as Record<string, unknown>;
    delete data.receipt;

    const [draft] = await tx
      .select({
        userId: hackerRsvpDrafts.userId,
        data: hackerRsvpDrafts.data,
      })
      .from(hackerRsvpDrafts)
      .where(eq(hackerRsvpDrafts.userId, user.id))
      .limit(1);
    const receipt = receiptFromDraft(draft);
    delete data.receipt;

    await tx
      .insert(hackerRsvpDrafts)
      .values({
        userId: user.id,
        data,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: hackerRsvpDrafts.userId,
        set: {
          data,
          updatedAt,
        },
      });

    return {
      receiptKey: receipt?.key ?? null,
      version: request.expectedVersion + 1,
    };
  });

  if (result.receiptKey) {
    try {
      await deleteRsvpReceipt(result.receiptKey);
    } catch (error) {
      console.error("Unable to delete removed RSVP receipt:", error);
    }
  }

  return {
    updatedAt,
    version: result.version,
  };
}

function finalInsertValues({
  userId,
  applicationId,
  data,
  receipt,
}: {
  userId: string;
  applicationId: string;
  data: RsvpFormData;
  receipt: NonNullable<ReturnType<typeof receiptFromDraft>> | null;
}) {
  return {
    userId,
    applicationId,
    travelPlan: data.travelPlan,
    travelGuideAcknowledged: data.travelGuideAcknowledged ?? null,
    flightBooked: data.flightBooked ?? null,
    receiptKey: receipt?.key ?? null,
    receiptOriginalName: receipt?.originalName ?? null,
    receiptContentType: receipt?.contentType ?? null,
    receiptSizeBytes: receipt?.sizeBytes ?? null,
    receiptBindingAcknowledged: data.receiptBindingAcknowledged ?? null,
    streetAddress: data.streetAddress,
    city: data.city,
    stateOrProvince: data.stateOrProvince ?? null,
    postalCode: data.postalCode ?? null,
    country: data.country,
    activitiesWaiverResponse: data.activitiesWaiverResponse,
    photoReleaseResponse: data.photoReleaseResponse,
    additionalNotes: data.additionalNotes ?? null,
  };
}

export async function submitRsvp(input: unknown): Promise<RsvpSubmitResult> {
  const user = await requireSessionUser();
  assertRsvpOpen();
  const request = submitRsvpInputSchema.parse(input);

  const [preflight] = await db
    .select({
      applicationId: hackerApplicants.id,
      applicationDecision: hackerApplicants.decision,
      transportationType: hackerApplicants.transportationType,
      comingFrom: hackerApplicants.comingFrom,
      needsTravelReimbursement: hackerApplicants.needsTravelReimbursement,
      reimbursementCents: reimbursementRegions.amountCents,
      finalSubmittedAt: hackerRsvps.submittedAt,
      draft: hackerRsvpDrafts,
    })
    .from(hackerApplicants)
    .leftJoin(hackerRsvps, eq(hackerRsvps.userId, user.id))
    .leftJoin(hackerRsvpDrafts, eq(hackerRsvpDrafts.userId, user.id))
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
    .where(eq(hackerApplicants.userId, user.id))
    .limit(1);

  if (!preflight) {
    throw new Error("A submitted MHacks 2026 application is required");
  }
  assertAcceptedRsvpDecision(preflight.applicationDecision);
  if (preflight.finalSubmittedAt) {
    await db
      .update(hackerApplicants)
      .set({
        decision: rsvpedDecision(preflight.applicationDecision),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(hackerApplicants.id, preflight.applicationId));
    return {
      alreadySubmitted: true,
      submittedAt: preflight.finalSubmittedAt,
    };
  }

  const travelEligibility = getRsvpTravelEligibility(
    {
      transportationType: preflight.transportationType,
      comingFrom: preflight.comingFrom,
      needsTravelReimbursement: preflight.needsTravelReimbursement,
      hasTravelAward: hasApprovedTravelAward(preflight.reimbursementCents),
    },
    {
      address:
        request.data && typeof request.data === "object"
          ? (request.data as RsvpDraftData)
          : undefined,
    },
  );
  if (
    travelEligibility.showTravelStep &&
    !travelEligibility.canRequestReimbursement &&
    requestedReimbursement(request.data)
  ) {
    throw new Error(
      "Travel reimbursement is only available if you have an approved travel reimbursement award.",
    );
  }
  const parsed = rsvpFormSchema.parse(
    withSessionAndTravelDefaults(request.data, user.email, travelEligibility),
  );

  const preflightReceipt = receiptFromDraft(preflight.draft);
  if (parsed.travelPlan === "reimbursement") {
    if (!parsed.receipt) {
      throw new Error("Please upload a travel reimbursement receipt");
    }
    if (!preflightReceipt) {
      throw new Error("Please upload a travel reimbursement receipt");
    }
    if (
      preflightReceipt.originalName !== parsed.receipt?.originalName ||
      preflightReceipt.contentType !== parsed.receipt?.contentType ||
      preflightReceipt.sizeBytes !== parsed.receipt?.sizeBytes
    ) {
      throw new Error("The confirmed receipt does not match this submission");
    }
    await validateRsvpReceiptInS3({
      key: preflightReceipt.key,
      userId: user.id,
      expectedContentType: parsed.receipt.contentType,
      expectedSizeBytes: parsed.receipt.sizeBytes,
    });
  }

  const result = await db.transaction(async (tx) => {
    assertRsvpOpen();
    const [application] = await tx
      .select({
        id: hackerApplicants.id,
        decision: hackerApplicants.decision,
      })
      .from(hackerApplicants)
      .where(eq(hackerApplicants.userId, user.id))
      .for("update");
    if (!application) {
      throw new Error("A submitted MHacks 2026 application is required");
    }
    assertAcceptedRsvpDecision(application.decision);

    const [existingFinal] = await tx
      .select({ submittedAt: hackerRsvps.submittedAt })
      .from(hackerRsvps)
      .where(
        and(
          eq(hackerRsvps.userId, user.id),
          eq(hackerRsvps.applicationId, application.id),
        ),
      )
      .limit(1);
    if (existingFinal) {
      await tx
        .update(hackerApplicants)
        .set({
          decision: rsvpedDecision(application.decision),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(hackerApplicants.id, application.id));
      return {
        response: {
          alreadySubmitted: true,
          submittedAt: existingFinal.submittedAt,
        },
        receiptKeyToDelete: null,
      };
    }

    const [lockedDraft] = await tx
      .select()
      .from(hackerRsvpDrafts)
      .where(eq(hackerRsvpDrafts.userId, user.id))
      .limit(1);
    const lockedReceipt = receiptFromDraft(lockedDraft);
    if (
      parsed.travelPlan === "reimbursement" &&
      (!lockedReceipt ||
        !preflightReceipt ||
        !receiptMatches(lockedReceipt, preflightReceipt))
    ) {
      throw new Error("The confirmed receipt changed; review it and retry");
    }

    const [inserted] = await tx
      .insert(hackerRsvps)
      .values(
        finalInsertValues({
          userId: user.id,
          applicationId: application.id,
          data: parsed,
          receipt: parsed.travelPlan === "reimbursement" ? lockedReceipt : null,
        }),
      )
      .onConflictDoNothing()
      .returning({ submittedAt: hackerRsvps.submittedAt });

    if (!inserted) {
      const [duplicate] = await tx
        .select({ submittedAt: hackerRsvps.submittedAt })
        .from(hackerRsvps)
        .where(eq(hackerRsvps.userId, user.id))
        .limit(1);
      if (!duplicate) throw new Error("Unable to submit RSVP");
      await tx
        .update(hackerApplicants)
        .set({
          decision: rsvpedDecision(application.decision),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(hackerApplicants.id, application.id));
      return {
        response: {
          alreadySubmitted: true,
          submittedAt: duplicate.submittedAt,
        },
        receiptKeyToDelete: null,
      };
    }

    await tx
      .delete(hackerRsvpDrafts)
      .where(eq(hackerRsvpDrafts.userId, user.id));

    await tx
      .update(hackerApplicants)
      .set({
        decision: rsvpedDecision(application.decision),
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        phoneNumber: parsed.phoneNumber,
        shirtSize: parsed.tshirtSize,
        allergiesDescription: applicationAllergiesDescription(parsed),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(hackerApplicants.id, application.id));

    return {
      response: {
        alreadySubmitted: false,
        submittedAt: inserted.submittedAt,
      },
      receiptKeyToDelete:
        parsed.travelPlan === "reimbursement"
          ? null
          : receiptFromDraft(lockedDraft)?.key,
    };
  });

  if (result.receiptKeyToDelete) {
    try {
      await deleteRsvpReceipt(result.receiptKeyToDelete);
    } catch (error) {
      console.error("Unable to delete unused RSVP receipt:", error);
    }
  }
  return result.response;
}
