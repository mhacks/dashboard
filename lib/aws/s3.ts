import { S3Client } from "@aws-sdk/client-s3";

export const RESUMES_BUCKET = process.env.RESUMES_BUCKET!;

// Shared by every path that accepts a resume upload (currently just
// /api/upload-resume, which buffers the whole file into the container's own
// memory before checking this) so the limit can't drift out of sync across
// callers. Kept low on purpose: this runs on an ECS Fargate task with only
// 512MB total memory (task-definition.json) shared across every concurrent
// request, and each buffered upload currently costs ~2x its size in memory
// (the parsed File's buffer, plus a separate Buffer copy) — a smaller cap
// keeps a burst of concurrent uploads further from exhausting that budget.
export const MAX_RESUME_SIZE_BYTES = 1 * 1024 * 1024;

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
