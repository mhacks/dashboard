import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import {
  isS3NotFound,
  MAX_RESUME_SIZE_BYTES,
  parseTotalBytesFromContentRange,
  resumeKeyBelongsToUser,
  s3,
  UPLOADS_BUCKET,
} from "@/lib/aws/s3";

export function resumeKeyForUser(userId: string) {
  return `resumes/${userId}.pdf`;
}

export function isPdfBuffer(buffer: Buffer) {
  return (
    buffer.length >= 4 && buffer.subarray(0, 4).toString("utf8") === "%PDF"
  );
}

const RESUME_FINGERPRINT_CACHE_TTL_MS = 60 * 1000;

let resumeFingerprintCache:
  | {
      expiresAt: number;
      fingerprints: Map<string, string>;
    }
  | undefined;

/**
 * Returns an opaque fingerprint for each stored resume object.
 *
 * S3 includes the ETag and byte size in object listings, so the review
 * dashboard can spot the exact same uploaded PDF under two user-scoped keys
 * without downloading applicants' resumes. This is deliberately only an
 * exact-file comparison: re-exporting a PDF may change its bytes and should be
 * left to the other identity signals (and ultimately an organizer) to assess.
 *
 * The short cache prevents a route render from repeatedly listing the bucket
 * while still allowing newly submitted applications to appear promptly.
 */
export async function getResumeObjectFingerprints(
  keys: readonly string[],
): Promise<Map<string, string>> {
  const requestedKeys = new Set(keys.filter(Boolean));
  if (requestedKeys.size === 0) return new Map();

  const now = Date.now();
  if (!resumeFingerprintCache || resumeFingerprintCache.expiresAt <= now) {
    const fingerprints = new Map<string, string>();
    let continuationToken: string | undefined;

    do {
      const page = await s3.send(
        new ListObjectsV2Command({
          Bucket: UPLOADS_BUCKET,
          Prefix: "resumes/",
          ContinuationToken: continuationToken,
        }),
      );

      for (const object of page.Contents ?? []) {
        if (!object.Key || !object.ETag || object.Size === undefined) continue;
        fingerprints.set(
          object.Key,
          `${object.Size}:${object.ETag.replaceAll('"', "")}`,
        );
      }

      continuationToken = page.IsTruncated
        ? page.NextContinuationToken
        : undefined;
    } while (continuationToken);

    resumeFingerprintCache = {
      expiresAt: now + RESUME_FINGERPRINT_CACHE_TTL_MS,
      fingerprints,
    };
  }

  return new Map(
    Array.from(requestedKeys)
      .map(
        (key) => [key, resumeFingerprintCache!.fingerprints.get(key)] as const,
      )
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  );
}

// Removes a stored resume. Deletes the exact key recorded on the application
// rather than sweeping the `resumes/{userId}` prefix: both upload paths write a
// single object (`resumes/{userId}.pdf` from the web form, `resumes/{userId}/…`
// from MCP) and the stored key is the one actually in use, so this needs no
// ListObjectsV2. S3 delete is idempotent — a missing key is not an error.
export async function deleteResumeObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: UPLOADS_BUCKET, Key: key }));
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
        Bucket: UPLOADS_BUCKET,
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
