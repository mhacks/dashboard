import { GetObjectCommand } from "@aws-sdk/client-s3";

import { RESUMES_BUCKET, s3 } from "@/lib/aws/s3";
import {
  contentDispositionForReceipt,
  type RsvpReceiptContentType,
} from "@/lib/rsvp/receipt";
import { isS3NotFound, validateRsvpReceiptInS3 } from "@/lib/rsvp/storage";

export type RsvpReceiptDownloadRecord = {
  key: string;
  userId: string;
  originalName: string;
  contentType: RsvpReceiptContentType;
  sizeBytes: number;
};

export async function createRsvpReceiptDownloadResponse(
  record: RsvpReceiptDownloadRecord,
  options: { disposition?: "attachment" | "inline" } = {},
): Promise<Response> {
  await validateRsvpReceiptInS3({
    key: record.key,
    userId: record.userId,
    expectedContentType: record.contentType,
    expectedSizeBytes: record.sizeBytes,
  });

  let object;
  try {
    object = await s3.send(
      new GetObjectCommand({
        Bucket: RESUMES_BUCKET,
        Key: record.key,
      }),
    );
  } catch (error) {
    if (isS3NotFound(error)) throw new Error("Receipt not found");
    throw error;
  }

  const body = object.Body?.transformToWebStream();
  if (!body) throw new Error("Receipt not found");

  return new Response(body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": contentDispositionForReceipt(
        record.originalName,
        options.disposition,
      ),
      "Content-Length": String(record.sizeBytes),
      "Content-Type": record.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
