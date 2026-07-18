"use server";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  RESUMES_BUCKET,
  s3,
  resumeKeyBelongsToUser,
  MAX_RESUME_SIZE_BYTES,
} from "@/lib/aws/s3";
import { createClient } from "@/lib/supabase/server";

// One fixed key per user, not one per call — a caller invoking this tool
// repeatedly (e.g. an agent retry-looping) reuses the same S3 object instead
// of accumulating a new one on every call, since nothing here ever deletes
// old objects. No versioning: the latest upload replaces whatever was there.
//
// Uploads go straight from the caller to S3 — this container never buffers
// the file (see agents/mcp-auth.md-adjacent discussion: the ECS task this
// runs on has only 512MB memory shared across every concurrent request, so
// receiving upload bytes here at all is a real crash risk under concurrent
// load; S3 absorbs that entirely and independently). `fileSizeBytes` gets
// baked into the presigned request as ContentLength, which S3 enforces as an
// exact match: the real PUT's Content-Length header (which HTTP clients set
// from the actual body automatically) must equal what was signed, or the
// request is rejected — so a caller can't declare a small size and upload
// something bigger. The true size has to be declared upfront, capped here.
export async function getResumeUploadUrl(
  userId: string,
  fileSizeBytes: number,
): Promise<{ uploadUrl: string; key: string }> {
  if (!Number.isInteger(fileSizeBytes) || fileSizeBytes <= 0) {
    throw new Error("fileSizeBytes must be a positive integer");
  }
  if (fileSizeBytes > MAX_RESUME_SIZE_BYTES) {
    throw new Error(
      `Resume exceeds the ${MAX_RESUME_SIZE_BYTES / (1024 * 1024)}MB limit`,
    );
  }

  const key = `resumes/${userId}.pdf`;

  const command = new PutObjectCommand({
    Bucket: RESUMES_BUCKET,
    Key: key,
    ContentType: "application/pdf",
    ContentLength: fileSizeBytes,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return { uploadUrl, key };
}

// Called directly from a client component (academic-information.tsx) as well
// as from server components that already resolved their own user — so `key`
// must never be trusted as-is. Identity is re-derived from the session here
// rather than taking a userId param, since a param can be passed wrong (or,
// if this were ever reachable from an untrusted caller, spoofed); re-deriving
// it means the check holds regardless of what the caller believes the key is.
export async function getResumeDownloadUrl(key: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !resumeKeyBelongsToUser(key, user.id)) {
    throw new Error("Resume not found");
  }

  const command = new GetObjectCommand({ Bucket: RESUMES_BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 604800 });
}
