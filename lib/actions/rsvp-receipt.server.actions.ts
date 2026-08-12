"use server";

import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { eq, sql } from "drizzle-orm";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth/guards";
import { RESUMES_BUCKET, s3 } from "@/lib/aws/s3";
import { db } from "@/lib/db";
import { hackerRsvpDrafts } from "@/lib/db/schema/rsvps";
import { lockWritableRsvpApplicant } from "@/lib/rsvp/access";
import {
  deleteRsvpReceiptOrQueue,
  enqueueRsvpReceiptCleanup,
  processQueuedRsvpReceiptCleanup,
} from "@/lib/rsvp/cleanup";
import { RSVP_DEADLINE_MS, assertRsvpOpen } from "@/lib/rsvp/deadline";
import {
  MAX_RSVP_RECEIPT_SIZE_BYTES,
  RSVP_RECEIPT_CONTENT_TYPES,
  receiptConfirmedKeyForUser,
  receiptStagingKeyForUser,
  sanitizeReceiptFilename,
} from "@/lib/rsvp/receipt";
import { copyRsvpReceipt, validateRsvpReceiptInS3 } from "@/lib/rsvp/storage";
import type { RsvpReceiptMetadata } from "@/lib/types/rsvps";

const receiptUploadSchema = z.strictObject({
  originalName: z.string().trim().min(1).max(255),
  contentType: z.enum(RSVP_RECEIPT_CONTENT_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_RSVP_RECEIPT_SIZE_BYTES),
});

const receiptUploadRequestSchema = receiptUploadSchema.extend({
  expectedReceiptVersion: z.number().int().nonnegative(),
});

const receiptConfirmationSchema = receiptUploadSchema.extend({
  uploadId: z.uuid(),
  expectedReceiptVersion: z.number().int().nonnegative(),
});

const receiptRemovalSchema = z.strictObject({
  expectedReceiptVersion: z.number().int().nonnegative(),
});

const receiptUploadLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
});

async function assertWritableUser(userId: string): Promise<number> {
  return db.transaction(async (tx) => {
    await lockWritableRsvpApplicant(tx, userId);
    const [draft] = await tx
      .select({ receiptVersion: hackerRsvpDrafts.receiptVersion })
      .from(hackerRsvpDrafts)
      .where(eq(hackerRsvpDrafts.userId, userId))
      .limit(1);
    return draft?.receiptVersion ?? 0;
  });
}

export async function requestRsvpReceiptUpload(input: unknown): Promise<{
  uploadUrl: string;
  uploadId: string;
  expectedReceiptVersion: number;
}> {
  const user = await requireSessionUser();
  assertRsvpOpen();
  const parsed = receiptUploadRequestSchema.parse(input);
  await processQueuedRsvpReceiptCleanup(user.id);
  try {
    await receiptUploadLimiter.consume(user.id);
  } catch {
    throw new Error("Too many receipt uploads. Please wait and try again.");
  }
  const uploadId = randomUUID();
  const key = receiptStagingKeyForUser(user.id, uploadId);
  const command = new PutObjectCommand({
    Bucket: RESUMES_BUCKET,
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

  const reservation = await db.transaction(async (tx) => {
    await lockWritableRsvpApplicant(tx, user.id);
    const [draft] = await tx
      .select({
        data: hackerRsvpDrafts.data,
        receiptVersion: hackerRsvpDrafts.receiptVersion,
        pendingReceiptUploadId: hackerRsvpDrafts.pendingReceiptUploadId,
      })
      .from(hackerRsvpDrafts)
      .where(eq(hackerRsvpDrafts.userId, user.id))
      .limit(1);
    const currentVersion = draft?.receiptVersion ?? 0;
    if (currentVersion !== parsed.expectedReceiptVersion) {
      throw new Error(
        "The receipt changed in another tab. Reload before uploading again.",
      );
    }
    const nextVersion = currentVersion + 1;
    const cleanupKeys = await enqueueRsvpReceiptCleanup(tx, user.id, [
      draft?.pendingReceiptUploadId
        ? receiptStagingKeyForUser(user.id, draft.pendingReceiptUploadId)
        : null,
    ]);

    await tx
      .insert(hackerRsvpDrafts)
      .values({
        userId: user.id,
        data: draft?.data ?? {},
        receiptVersion: nextVersion,
        pendingReceiptUploadId: uploadId,
      })
      .onConflictDoUpdate({
        target: hackerRsvpDrafts.userId,
        set: {
          receiptVersion: sql`${hackerRsvpDrafts.receiptVersion} + 1`,
          pendingReceiptUploadId: uploadId,
          updatedAt: new Date().toISOString(),
        },
      });

    return {
      receiptVersion: nextVersion,
      cleanupKeys,
    };
  });

  await processQueuedRsvpReceiptCleanup(user.id, reservation.cleanupKeys);

  return {
    uploadUrl,
    uploadId,
    expectedReceiptVersion: reservation.receiptVersion,
  };
}

export async function confirmRsvpReceiptUpload(input: unknown): Promise<{
  receipt: RsvpReceiptMetadata;
  receiptVersion: number;
}> {
  const user = await requireSessionUser();
  assertRsvpOpen();
  const parsed = receiptConfirmationSchema.parse(input);
  await assertWritableUser(user.id);

  const stagingKey = receiptStagingKeyForUser(user.id, parsed.uploadId);
  const confirmedKey = receiptConfirmedKeyForUser(user.id, randomUUID());
  try {
    await validateRsvpReceiptInS3({
      key: stagingKey,
      userId: user.id,
      expectedContentType: parsed.contentType,
      expectedSizeBytes: parsed.sizeBytes,
    });
    await copyRsvpReceipt({
      sourceKey: stagingKey,
      destinationKey: confirmedKey,
    });
    const verified = await validateRsvpReceiptInS3({
      key: confirmedKey,
      userId: user.id,
      expectedContentType: parsed.contentType,
      expectedSizeBytes: parsed.sizeBytes,
    });
    const originalName = sanitizeReceiptFilename(parsed.originalName);
    const updatedAt = new Date().toISOString();

    const mutation = await db.transaction(async (tx) => {
      await lockWritableRsvpApplicant(tx, user.id);
      const [existingDraft] = await tx
        .select({
          receiptKey: hackerRsvpDrafts.receiptKey,
          receiptVersion: hackerRsvpDrafts.receiptVersion,
          pendingReceiptUploadId: hackerRsvpDrafts.pendingReceiptUploadId,
        })
        .from(hackerRsvpDrafts)
        .where(eq(hackerRsvpDrafts.userId, user.id))
        .limit(1);
      const currentReceiptVersion = existingDraft?.receiptVersion ?? 0;
      if (
        currentReceiptVersion !== parsed.expectedReceiptVersion ||
        existingDraft?.pendingReceiptUploadId !== parsed.uploadId
      ) {
        throw new Error(
          "The receipt changed in another tab. Reload before replacing it.",
        );
      }
      const cleanupKeys = await enqueueRsvpReceiptCleanup(tx, user.id, [
        stagingKey,
        existingDraft?.receiptKey ?? null,
      ]);

      await tx
        .update(hackerRsvpDrafts)
        .set({
          receiptKey: confirmedKey,
          receiptOriginalName: originalName,
          receiptContentType: verified.contentType,
          receiptSizeBytes: verified.sizeBytes,
          pendingReceiptUploadId: null,
          updatedAt,
        })
        .where(eq(hackerRsvpDrafts.userId, user.id));

      return {
        receiptVersion: currentReceiptVersion,
        cleanupKeys,
      };
    });

    await processQueuedRsvpReceiptCleanup(user.id, mutation.cleanupKeys);

    return {
      receipt: {
        originalName,
        contentType: verified.contentType,
        sizeBytes: verified.sizeBytes,
      },
      receiptVersion: mutation.receiptVersion,
    };
  } catch (error) {
    await Promise.all([
      deleteRsvpReceiptOrQueue(user.id, confirmedKey),
      deleteRsvpReceiptOrQueue(user.id, stagingKey),
    ]);
    throw error;
  }
}

export async function removeRsvpReceipt(input: unknown): Promise<{
  receiptVersion: number;
}> {
  const user = await requireSessionUser();
  assertRsvpOpen();
  const parsed = receiptRemovalSchema.parse(input);

  const result = await db.transaction(async (tx) => {
    await lockWritableRsvpApplicant(tx, user.id);
    const [draft] = await tx
      .select({
        data: hackerRsvpDrafts.data,
        receiptKey: hackerRsvpDrafts.receiptKey,
        receiptVersion: hackerRsvpDrafts.receiptVersion,
        pendingReceiptUploadId: hackerRsvpDrafts.pendingReceiptUploadId,
      })
      .from(hackerRsvpDrafts)
      .where(eq(hackerRsvpDrafts.userId, user.id))
      .limit(1);

    if (!draft) {
      if (parsed.expectedReceiptVersion !== 0) {
        throw new Error(
          "The receipt changed in another tab. Reload before removing it.",
        );
      }
      return {
        cleanupKeys: [],
        receiptVersion: 0,
      };
    }
    if (draft.receiptVersion !== parsed.expectedReceiptVersion) {
      throw new Error(
        "The receipt changed in another tab. Reload before removing it.",
      );
    }
    if (!draft.receiptKey && !draft.pendingReceiptUploadId) {
      return {
        cleanupKeys: [],
        receiptVersion: draft.receiptVersion,
      };
    }
    const data = { ...draft.data };
    delete data.receipt;
    const receiptVersion = draft.receiptVersion + 1;
    const cleanupKeys = await enqueueRsvpReceiptCleanup(tx, user.id, [
      draft.receiptKey,
      draft.pendingReceiptUploadId
        ? receiptStagingKeyForUser(user.id, draft.pendingReceiptUploadId)
        : null,
    ]);
    await tx
      .update(hackerRsvpDrafts)
      .set({
        data,
        receiptKey: null,
        receiptOriginalName: null,
        receiptContentType: null,
        receiptSizeBytes: null,
        receiptVersion: sql`${hackerRsvpDrafts.receiptVersion} + 1`,
        pendingReceiptUploadId: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(hackerRsvpDrafts.userId, user.id));
    return {
      cleanupKeys,
      receiptVersion,
    };
  });

  await processQueuedRsvpReceiptCleanup(user.id, result.cleanupKeys);
  return { receiptVersion: result.receiptVersion };
}
