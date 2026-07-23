import { GetObjectCommand } from "@aws-sdk/client-s3";
import {
  MAX_RESUME_SIZE_BYTES,
  RESUMES_BUCKET,
  resumeKeyBelongsToUser,
  s3,
} from "@/lib/aws/s3";

export function resumeKeyForUser(userId: string) {
  return `resumes/${userId}.pdf`;
}

export function isPdfBuffer(buffer: Buffer) {
  return (
    buffer.length >= 4 && buffer.subarray(0, 4).toString("utf8") === "%PDF"
  );
}

function parseTotalBytesFromContentRange(contentRange: string | undefined) {
  const match = contentRange?.match(/\/(\d+)$/);
  return match ? Number(match[1]) : undefined;
}

function isS3NotFound(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error.name === "NoSuchKey" || error.name === "NotFound")
  );
}

// Confirms the object exists in S3, belongs to the user, is within size limits,
// and starts with the PDF magic bytes. Returns the stored byte size.
export async function validateResumeInS3(
  key: string,
  userId: string,
): Promise<number> {
  if (!resumeKeyBelongsToUser(key, userId)) {
    throw new Error(
      "Resume must come from your own upload — get a fresh upload URL and try again.",
    );
  }

  let object;
  try {
    object = await s3.send(
      new GetObjectCommand({
        Bucket: RESUMES_BUCKET,
        Key: key,
        Range: "bytes=0-3",
      }),
    );
  } catch (error) {
    if (isS3NotFound(error)) {
      throw new Error(
        "Resume not found — upload your PDF and try again before submitting.",
      );
    }
    throw error;
  }

  const header = await object.Body?.transformToByteArray();
  if (!header || !isPdfBuffer(Buffer.from(header))) {
    throw new Error("Resume must be a valid PDF.");
  }

  const size = parseTotalBytesFromContentRange(object.ContentRange);
  if (size === undefined || size <= 0) {
    throw new Error("Resume not found — upload your PDF and try again.");
  }
  if (size > MAX_RESUME_SIZE_BYTES) {
    throw new Error(
      `Resume exceeds the ${MAX_RESUME_SIZE_BYTES / (1024 * 1024)}MB limit`,
    );
  }

  return size;
}
