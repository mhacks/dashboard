import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

import { RESUMES_BUCKET, s3 } from "@/lib/aws/s3";
import {
  assertValidRsvpReceipt,
  isRsvpReceiptContentType,
  rsvpReceiptKeyBelongsToUser,
  type RsvpReceiptContentType,
} from "@/lib/rsvp/receipt";

function parseTotalBytes(contentRange: string | undefined): number | undefined {
  const match = contentRange?.match(/\/(\d+)$/u);
  return match ? Number(match[1]) : undefined;
}

export function isS3NotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error.name === "NoSuchKey" || error.name === "NotFound")
  );
}

export async function validateRsvpReceiptInS3({
  key,
  userId,
  expectedContentType,
  expectedSizeBytes,
}: {
  key: string;
  userId: string;
  expectedContentType?: RsvpReceiptContentType;
  expectedSizeBytes?: number;
}): Promise<{
  contentType: RsvpReceiptContentType;
  sizeBytes: number;
}> {
  if (!rsvpReceiptKeyBelongsToUser(key, userId)) {
    throw new Error("Receipt must come from your own upload");
  }

  let object;
  try {
    object = await s3.send(
      new GetObjectCommand({
        Bucket: RESUMES_BUCKET,
        Key: key,
        Range: "bytes=0-7",
      }),
    );
  } catch (error) {
    if (isS3NotFound(error)) {
      throw new Error("Receipt not found — upload it again and retry");
    }
    throw error;
  }

  const leadingBytes = await object.Body?.transformToByteArray();
  const sizeBytes = parseTotalBytes(object.ContentRange);
  const contentType = object.ContentType;
  if (!leadingBytes || sizeBytes === undefined || !contentType) {
    throw new Error("Receipt could not be verified");
  }
  if (!isRsvpReceiptContentType(contentType)) {
    throw new Error("Receipt must be a PDF, PNG, or JPEG");
  }

  assertValidRsvpReceipt({
    contentType,
    sizeBytes,
    leadingBytes,
  });

  if (
    expectedContentType !== undefined &&
    contentType !== expectedContentType
  ) {
    throw new Error("Receipt file type changed during upload");
  }
  if (expectedSizeBytes !== undefined && sizeBytes !== expectedSizeBytes) {
    throw new Error("Receipt file size changed during upload");
  }

  return { contentType, sizeBytes };
}

export async function copyRsvpReceipt({
  sourceKey,
  destinationKey,
}: {
  sourceKey: string;
  destinationKey: string;
}): Promise<void> {
  await s3.send(
    new CopyObjectCommand({
      Bucket: RESUMES_BUCKET,
      CopySource: `${RESUMES_BUCKET}/${sourceKey}`,
      Key: destinationKey,
    }),
  );
}

export async function deleteRsvpReceipt(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: RESUMES_BUCKET,
      Key: key,
    }),
  );
}
