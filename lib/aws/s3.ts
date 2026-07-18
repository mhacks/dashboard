import { S3Client } from "@aws-sdk/client-s3";

export const RESUMES_BUCKET = process.env.RESUMES_BUCKET!;

// Shared by every path that accepts a resume upload — /api/upload-resume
// (buffers the file server-side and checks this directly) and
// getResumeUploadUrl (signs a presigned PUT capped to this via ContentLength)
// — so the limit can't drift out of sync between them.
export const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024;

const credentials = {
  accessKeyId: process.env.RESUMES_ACCESS_KEY_ID!,
  secretAccessKey: process.env.RESUMES_SECRET_ACCESS_KEY!,
};

const clientOptions = {
  credentials,
  requestChecksumCalculation: "WHEN_REQUIRED" as const,
  responseChecksumValidation: "WHEN_REQUIRED" as const,
};

// Local: RESUMES_REGION=local (set by gen-env-local.sh) → Supabase Storage.
// Production: us-east-2 (default) → AWS S3.
export const s3 =
  process.env.RESUMES_REGION === "local"
    ? new S3Client({
        ...clientOptions,
        region: "local",
        endpoint: process.env.RESUMES_S3_URL!,
        forcePathStyle: true,
      })
    : new S3Client({
        ...clientOptions,
        region: process.env.RESUMES_REGION ?? "us-east-2",
      });

// Resume keys come in two shapes depending on upload path: `resumes/{userId}/...`
// (apply_get_resume_upload_url, MCP) and `resumes/{userId}.pdf` (/api/upload-resume,
// web form). Both are scoped by prefix, never validated to actually belong to
// the account they're attached to — `resume` is a plain client-suppliable string
// everywhere it's stored (draft, submitted application), so without this check
// a user could reference another user's key and either read their resume via a
// generated download URL, or have someone else's key silently attached to their
// own application. Checking for `/` or `.` right after the id stops one user's
// id from prefix-matching a different (longer) id — moot for same-length UUIDs,
// but keeps the check correct regardless of id format.
export function resumeKeyBelongsToUser(key: string, userId: string): boolean {
  const prefix = `resumes/${userId}`;
  if (!key.startsWith(prefix)) return false;
  const next = key[prefix.length];
  return next === "/" || next === ".";
}
