"use server";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { RESUMES_BUCKET, s3, resumeKeyBelongsToUser } from "@/lib/aws/s3";
import { createClient } from "@/lib/supabase/server";

// One fixed key per user, not one per call — a caller invoking this tool
// repeatedly (e.g. an agent retry-looping) reuses the same S3 object instead
// of accumulating a new one on every call, since nothing here ever deletes
// old objects. No versioning: the latest upload replaces whatever was there.
export async function getResumeUploadUrl(
  userId: string,
): Promise<{ uploadUrl: string; key: string }> {
  const key = `resumes/${userId}.pdf`;

  const command = new PutObjectCommand({
    Bucket: RESUMES_BUCKET,
    Key: key,
    ContentType: "application/pdf",
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
