"use server";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import {
  hackerRsvpDrafts,
  hackerRsvps,
  type HackerRsvpDraftRow,
} from "@/lib/db/schema/rsvps";
import { lockWritableRsvpApplicant } from "@/lib/rsvp/access";
import {
  enqueueRsvpReceiptCleanup,
  processQueuedRsvpReceiptCleanup,
} from "@/lib/rsvp/cleanup";
import { assertRsvpOpen } from "@/lib/rsvp/deadline";
import { receiptStagingKeyForUser } from "@/lib/rsvp/receipt";
import { validateRsvpReceiptInS3 } from "@/lib/rsvp/storage";
import {
  rsvpDraftSchema,
  rsvpFormSchema,
  type RsvpFormData,
} from "@/lib/types/rsvps";

const saveDraftInputSchema = z.strictObject({
  data: z.unknown(),
  expectedVersion: z.number().int().nonnegative(),
});

const saveDraftWithoutReceiptInputSchema = saveDraftInputSchema.extend({
  expectedReceiptVersion: z.number().int().nonnegative(),
});

const submitRsvpInputSchema = z.strictObject({
  data: z.unknown(),
  expectedReceiptVersion: z.number().int().nonnegative(),
});

export type RsvpSubmitResult = {
  alreadySubmitted: boolean;
  submittedAt: string;
};

type DraftReceipt = Pick<
  HackerRsvpDraftRow,
  | "receiptKey"
  | "receiptOriginalName"
  | "receiptContentType"
  | "receiptSizeBytes"
>;

function receiptFromDraft(draft: DraftReceipt | null | undefined) {
  if (
    !draft?.receiptKey ||
    !draft.receiptOriginalName ||
    !draft.receiptContentType ||
    !draft.receiptSizeBytes
  ) {
    return null;
  }
  return {
    key: draft.receiptKey,
    originalName: draft.receiptOriginalName,
    contentType: draft.receiptContentType,
    sizeBytes: draft.receiptSizeBytes,
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
    emailMatchesApplication: true,
    incorrectEmailRiskAcknowledged: true,
  };
}

export async function saveRsvpDraft(
  input: unknown,
): Promise<{ updatedAt: string; version: number }> {
  const user = await requireSessionUser();
  assertRsvpOpen();
  const request = saveDraftInputSchema.parse(input);
  const parsed = rsvpDraftSchema.parse(
    withSessionIdentity(request.data, user.email),
  );
  const data = { ...parsed } as Record<string, unknown>;
  delete data.receipt;
  const updatedAt = new Date().toISOString();

  const nextVersion = await db.transaction(async (tx) => {
    await lockWritableRsvpApplicant(tx, user.id);
    const [existingDraft] = await tx
      .select({ dataVersion: hackerRsvpDrafts.dataVersion })
      .from(hackerRsvpDrafts)
      .where(eq(hackerRsvpDrafts.userId, user.id))
      .limit(1);
    const currentVersion = existingDraft?.dataVersion ?? 0;
    if (currentVersion !== request.expectedVersion) {
      throw new Error(
        "This RSVP draft changed in another tab. Reload before saving again.",
      );
    }
    const nextVersion = currentVersion + 1;

    await tx
      .insert(hackerRsvpDrafts)
      .values({
        userId: user.id,
        data,
        dataVersion: nextVersion,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: hackerRsvpDrafts.userId,
        set: {
          data,
          dataVersion: sql`${hackerRsvpDrafts.dataVersion} + 1`,
          updatedAt,
        },
      });

    return nextVersion;
  });

  return { updatedAt, version: nextVersion };
}

export async function saveRsvpDraftWithoutReceipt(input: unknown): Promise<{
  updatedAt: string;
  version: number;
  receiptVersion: number;
}> {
  const user = await requireSessionUser();
  assertRsvpOpen();
  const request = saveDraftWithoutReceiptInputSchema.parse(input);
  const parsed = rsvpDraftSchema.parse(
    withSessionIdentity(request.data, user.email),
  );
  if (!parsed.travelPlan || parsed.travelPlan === "reimbursement") {
    throw new Error("Choose a non-reimbursement travel plan");
  }

  const data = { ...parsed } as Record<string, unknown>;
  delete data.receipt;
  const updatedAt = new Date().toISOString();

  const result = await db.transaction(async (tx) => {
    await lockWritableRsvpApplicant(tx, user.id);
    const [draft] = await tx
      .select({
        dataVersion: hackerRsvpDrafts.dataVersion,
        receiptKey: hackerRsvpDrafts.receiptKey,
        receiptVersion: hackerRsvpDrafts.receiptVersion,
        pendingReceiptUploadId: hackerRsvpDrafts.pendingReceiptUploadId,
      })
      .from(hackerRsvpDrafts)
      .where(eq(hackerRsvpDrafts.userId, user.id))
      .limit(1);
    const dataVersion = draft?.dataVersion ?? 0;
    const receiptVersion = draft?.receiptVersion ?? 0;
    if (
      dataVersion !== request.expectedVersion ||
      receiptVersion !== request.expectedReceiptVersion
    ) {
      throw new Error(
        "This RSVP changed in another tab. Reload before changing travel plans.",
      );
    }
    const nextDataVersion = dataVersion + 1;
    const nextReceiptVersion = receiptVersion + 1;
    const cleanupKeys = await enqueueRsvpReceiptCleanup(tx, user.id, [
      draft?.receiptKey ?? null,
      draft?.pendingReceiptUploadId
        ? receiptStagingKeyForUser(user.id, draft.pendingReceiptUploadId)
        : null,
    ]);

    await tx
      .insert(hackerRsvpDrafts)
      .values({
        userId: user.id,
        data,
        dataVersion: nextDataVersion,
        receiptVersion: nextReceiptVersion,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: hackerRsvpDrafts.userId,
        set: {
          data,
          dataVersion: nextDataVersion,
          receiptKey: null,
          receiptOriginalName: null,
          receiptContentType: null,
          receiptSizeBytes: null,
          receiptVersion: nextReceiptVersion,
          pendingReceiptUploadId: null,
          updatedAt,
        },
      });

    return {
      cleanupKeys,
      version: nextDataVersion,
      receiptVersion: nextReceiptVersion,
    };
  });

  await processQueuedRsvpReceiptCleanup(user.id, result.cleanupKeys);

  return {
    updatedAt,
    version: result.version,
    receiptVersion: result.receiptVersion,
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
    legalName: data.legalName,
    preferredName: data.preferredName,
    email: data.email,
    emailMatchesApplication: data.emailMatchesApplication,
    incorrectEmailRiskAcknowledged: data.incorrectEmailRiskAcknowledged,
    dietaryRestrictions: data.dietaryRestrictions,
    otherDietaryRestriction: data.otherDietaryRestriction ?? null,
    tshirtSize: data.tshirtSize,
    travelPlan: data.travelPlan,
    travelGuideAcknowledged:
      data.travelPlan === "reimbursement"
        ? (data.travelGuideAcknowledged ?? null)
        : null,
    flightBooked:
      data.travelPlan === "reimbursement" ? (data.flightBooked ?? null) : null,
    receiptKey: receipt?.key ?? null,
    receiptOriginalName: receipt?.originalName ?? null,
    receiptContentType: receipt?.contentType ?? null,
    receiptSizeBytes: receipt?.sizeBytes ?? null,
    receiptBindingAcknowledged:
      data.travelPlan === "reimbursement"
        ? (data.receiptBindingAcknowledged ?? null)
        : null,
    streetAddress: data.streetAddress,
    city: data.city,
    stateOrProvince: data.stateOrProvince ?? "",
    postalCode: data.postalCode ?? "",
    country: data.country,
    activitiesWaiverResponse: data.activitiesWaiverResponse,
    photoReleaseResponse: data.photoReleaseResponse,
    additionalNotes: data.additionalNotes || null,
  };
}

export async function submitRsvp(input: unknown): Promise<RsvpSubmitResult> {
  const user = await requireSessionUser();
  assertRsvpOpen();
  const request = submitRsvpInputSchema.parse(input);
  const parsed = rsvpFormSchema.parse(
    withSessionIdentity(request.data, user.email),
  );

  const [preflight] = await db
    .select({
      applicationId: hackerApplicants.id,
      finalSubmittedAt: hackerRsvps.submittedAt,
      draft: hackerRsvpDrafts,
    })
    .from(hackerApplicants)
    .leftJoin(hackerRsvps, eq(hackerRsvps.userId, user.id))
    .leftJoin(hackerRsvpDrafts, eq(hackerRsvpDrafts.userId, user.id))
    .where(eq(hackerApplicants.userId, user.id))
    .limit(1);

  if (!preflight) {
    throw new Error("A submitted MHacks 2026 application is required");
  }
  if (preflight.finalSubmittedAt) {
    return {
      alreadySubmitted: true,
      submittedAt: preflight.finalSubmittedAt,
    };
  }

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
      .select({ id: hackerApplicants.id })
      .from(hackerApplicants)
      .where(eq(hackerApplicants.userId, user.id))
      .for("update");
    if (!application) {
      throw new Error("A submitted MHacks 2026 application is required");
    }

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
      return {
        response: {
          alreadySubmitted: true,
          submittedAt: existingFinal.submittedAt,
        },
        cleanupKeys: [],
      };
    }

    const [lockedDraft] = await tx
      .select()
      .from(hackerRsvpDrafts)
      .where(eq(hackerRsvpDrafts.userId, user.id))
      .limit(1);
    if ((lockedDraft?.receiptVersion ?? 0) !== request.expectedReceiptVersion) {
      throw new Error(
        "The receipt changed in another tab. Reload before submitting.",
      );
    }
    if (
      parsed.travelPlan === "reimbursement" &&
      lockedDraft?.pendingReceiptUploadId
    ) {
      throw new Error("Finish the pending receipt upload before submitting.");
    }
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
      return {
        response: {
          alreadySubmitted: true,
          submittedAt: duplicate.submittedAt,
        },
        cleanupKeys: [],
      };
    }

    const cleanupKeys = await enqueueRsvpReceiptCleanup(tx, user.id, [
      parsed.travelPlan === "reimbursement"
        ? null
        : (lockedDraft?.receiptKey ?? null),
      lockedDraft?.pendingReceiptUploadId
        ? receiptStagingKeyForUser(user.id, lockedDraft.pendingReceiptUploadId)
        : null,
    ]);

    await tx
      .delete(hackerRsvpDrafts)
      .where(eq(hackerRsvpDrafts.userId, user.id));

    return {
      response: {
        alreadySubmitted: false,
        submittedAt: inserted.submittedAt,
      },
      cleanupKeys,
    };
  });

  await processQueuedRsvpReceiptCleanup(user.id, result.cleanupKeys);
  return result.response;
}
