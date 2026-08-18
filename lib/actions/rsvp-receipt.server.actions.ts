"use server";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, eq } from "drizzle-orm";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth/guards";
import { UPLOADS_BUCKET, s3 } from "@/lib/aws/s3";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import {
  hackerReimbursements,
  reimbursementRegions,
} from "@/lib/db/schema/reimbursements";
import { hackerRsvpDrafts, hackerRsvps } from "@/lib/db/schema/rsvps";
import { assertAcceptedRsvpDecision } from "@/lib/rsvp/access";
import { RSVP_DEADLINE_MS, assertRsvpOpen } from "@/lib/rsvp/deadline";
import {
  MAX_RSVP_RECEIPT_SIZE_BYTES,
  RSVP_RECEIPT_CONTENT_TYPE,
  contentDispositionForReceipt,
  receiptKeyForUser,
  sanitizeReceiptFilename,
} from "@/lib/rsvp/receipt";
import { validateRsvpReceiptInS3 } from "@/lib/rsvp/storage";
import {
  assertReceiptUploadAllowed,
  getRsvpTravelEligibility,
  hasApprovedTravelAward,
} from "@/lib/rsvp/travel-eligibility";
import type { RsvpDraftData, RsvpReceiptMetadata } from "@/lib/types/rsvps";

const receiptSizeSchema = z.strictObject({
  contentType: z.literal(RSVP_RECEIPT_CONTENT_TYPE),
  sizeBytes: z.number().int().positive().max(MAX_RSVP_RECEIPT_SIZE_BYTES),
});

const receiptUploadRequestSchema = receiptSizeSchema;

const receiptConfirmationSchema = receiptSizeSchema.extend({
  originalName: z.string().trim().min(1).max(255),
});

const receiptUploadLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
});

function draftData(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" && !Array.isArray(data)
    ? { ...(data as Record<string, unknown>) }
    : {};
}

async function assertCanUploadReceipt(
  userId: string,
): Promise<Record<string, unknown>> {
  assertRsvpOpen();
  const [row] = await db
    .select({
      applicationId: hackerApplicants.id,
      decision: hackerApplicants.decision,
      transportationType: hackerApplicants.transportationType,
      comingFrom: hackerApplicants.comingFrom,
      needsTravelReimbursement: hackerApplicants.needsTravelReimbursement,
      reimbursementCents: reimbursementRegions.amountCents,
      finalId: hackerRsvps.id,
      draftData: hackerRsvpDrafts.data,
    })
    .from(hackerApplicants)
    .leftJoin(hackerRsvps, eq(hackerRsvps.userId, userId))
    .leftJoin(hackerRsvpDrafts, eq(hackerRsvpDrafts.userId, userId))
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

  if (!row) {
    throw new Error("A submitted MHacks 2026 application is required");
  }
  assertAcceptedRsvpDecision(row.decision);
  if (row.finalId) {
    throw new Error("Your RSVP has already been submitted");
  }

  const data = draftData(row.draftData);
  assertReceiptUploadAllowed(
    getRsvpTravelEligibility(
      {
        transportationType: row.transportationType,
        comingFrom: row.comingFrom,
        needsTravelReimbursement: row.needsTravelReimbursement,
        hasTravelAward: hasApprovedTravelAward(row.reimbursementCents),
      },
      {
        address: data as RsvpDraftData,
      },
    ),
  );
  if (data.travelPlan !== "reimbursement") {
    throw new Error("Choose travel reimbursement before uploading a receipt.");
  }

  return data;
}

export async function requestRsvpReceiptUpload(input: unknown): Promise<{
  uploadUrl: string;
}> {
  const user = await requireSessionUser();
  assertRsvpOpen();
  const parsed = receiptUploadRequestSchema.parse(input);
  try {
    await receiptUploadLimiter.consume(user.id);
  } catch {
    throw new Error("Too many receipt uploads. Please wait and try again.");
  }

  await assertCanUploadReceipt(user.id);

  const key = receiptKeyForUser(user.id);
  const command = new PutObjectCommand({
    Bucket: UPLOADS_BUCKET,
    Key: key,
    ContentType: parsed.contentType,
    ContentLength: parsed.sizeBytes,
  });
  const secondsUntilDeadline = Math.max(
    1,
    Math.floor((RSVP_DEADLINE_MS - Date.now()) / 1_000),
  );
  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: Math.min(300, secondsUntilDeadline),
  });

  return {
    uploadUrl,
  };
}

export async function confirmRsvpReceiptUpload(input: unknown): Promise<{
  receipt: RsvpReceiptMetadata;
}> {
  const user = await requireSessionUser();
  assertRsvpOpen();
  const parsed = receiptConfirmationSchema.parse(input);

  const key = receiptKeyForUser(user.id);
  await validateRsvpReceiptInS3({
    key,
    userId: user.id,
    expectedContentType: parsed.contentType,
    expectedSizeBytes: parsed.sizeBytes,
  });
  const originalName = sanitizeReceiptFilename(parsed.originalName);
  const updatedAt = new Date().toISOString();
  const existingData = await assertCanUploadReceipt(user.id);
  const receipt = {
    originalName,
    contentType: parsed.contentType,
    sizeBytes: parsed.sizeBytes,
  } satisfies RsvpReceiptMetadata;

  await db
    .insert(hackerRsvpDrafts)
    .values({
      userId: user.id,
      data: {
        ...existingData,
        receipt,
      },
      updatedAt,
    })
    .onConflictDoUpdate({
      target: hackerRsvpDrafts.userId,
      set: {
        data: {
          ...existingData,
          receipt,
        },
        updatedAt,
      },
    });

  return {
    receipt,
  };
}

export async function getRsvpReceiptPreviewUrl(): Promise<{
  previewUrl: string | null;
}> {
  const user = await requireSessionUser();
  assertRsvpOpen();
  const [draft] = await db
    .select({
      data: hackerRsvpDrafts.data,
    })
    .from(hackerRsvpDrafts)
    .where(eq(hackerRsvpDrafts.userId, user.id))
    .limit(1);
  const receipt = z
    .object({
      originalName: z.string(),
      contentType: z.literal(RSVP_RECEIPT_CONTENT_TYPE),
      sizeBytes: z.number().int().positive(),
    })
    .safeParse(draftData(draft?.data).receipt);

  if (!receipt.success) return { previewUrl: null };

  const key = receiptKeyForUser(user.id);
  await validateRsvpReceiptInS3({
    key,
    userId: user.id,
    expectedContentType: receipt.data.contentType,
    expectedSizeBytes: receipt.data.sizeBytes,
  });

  const previewUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: UPLOADS_BUCKET,
      Key: key,
      ResponseContentDisposition: contentDispositionForReceipt(
        receipt.data.originalName,
        "inline",
      ),
      ResponseContentType: receipt.data.contentType,
    }),
    { expiresIn: 300 },
  );

  return { previewUrl };
}
