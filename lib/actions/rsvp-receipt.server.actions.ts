"use server";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, eq } from "drizzle-orm";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth/guards";
import { RESUMES_BUCKET, s3 } from "@/lib/aws/s3";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import {
  hackerReimbursements,
  reimbursementRegions,
} from "@/lib/db/schema/reimbursements";
import { hackerRsvpDrafts, hackerRsvps } from "@/lib/db/schema/rsvps";
import { assertAcceptedRsvpDecision } from "@/lib/rsvp/access";
import { assertRsvpOpen } from "@/lib/rsvp/deadline";
import {
  RSVP_RECEIPT_CONTENT_TYPE,
  assertValidRsvpReceipt,
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

// Web upload path (receipt-upload.tsx) — same tradeoff as uploadResume: a
// single browser-driven upload is rare enough that buffering the file here
// is acceptable in exchange for the PDF magic-byte check.
export async function uploadRsvpReceipt(
  formData: FormData,
): Promise<{ error: string } | { receipt: RsvpReceiptMetadata }> {
  const user = await requireSessionUser();
  assertRsvpOpen();
  try {
    await receiptUploadLimiter.consume(user.id);
  } catch {
    return { error: "Too many receipt uploads. Please wait and try again." };
  }

  const existingData = await assertCanUploadReceipt(user.id);
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "No file provided" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    assertValidRsvpReceipt({
      contentType: file.type,
      sizeBytes: file.size,
      leadingBytes: buffer.subarray(0, 16),
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid receipt",
    };
  }

  const key = receiptKeyForUser(user.id);
  await s3.send(
    new PutObjectCommand({
      Bucket: RESUMES_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: RSVP_RECEIPT_CONTENT_TYPE,
      ContentLength: buffer.length,
    }),
  );

  const originalName = sanitizeReceiptFilename(file.name);
  const updatedAt = new Date().toISOString();
  const receipt = {
    originalName,
    contentType: RSVP_RECEIPT_CONTENT_TYPE,
    sizeBytes: buffer.length,
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

  return { receipt };
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
      Bucket: RESUMES_BUCKET,
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
