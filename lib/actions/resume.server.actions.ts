"use server";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  RESUMES_BUCKET,
  s3,
  resumeKeyBelongsToUser,
  MAX_RESUME_SIZE_BYTES,
} from "@/lib/aws/s3";
import { requireSessionUser } from "@/lib/auth/guards";
import { getPostHogClient } from "@/lib/posthog-server";
import { isPdfBuffer, resumeKeyForUser } from "@/lib/resume";

const RESUME_DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

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

  const key = resumeKeyForUser(userId);

  const command = new PutObjectCommand({
    Bucket: RESUMES_BUCKET,
    Key: key,
    ContentType: "application/pdf",
    ContentLength: fileSizeBytes,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return { uploadUrl, key };
}

// Web upload path (academic-information.tsx) — a single browser-driven
// upload is a much smaller, rarer load than a potentially-looping agent, so
// buffering the file into this container's memory here is an acceptable
// tradeoff for the extra validation (magic-byte check) it buys. The MCP path
// above stays presigned-URL-only for the reasons in its own comment.
export async function uploadResume(
  formData: FormData,
): Promise<{ error: string } | { key: string }> {
  const { id: userId } = await requireSessionUser();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return { error: "No file provided" };
  }
  if (file.type !== "application/pdf") {
    return { error: "File must be a PDF" };
  }
  if (file.size > MAX_RESUME_SIZE_BYTES) {
    return {
      error: `File exceeds ${MAX_RESUME_SIZE_BYTES / (1024 * 1024)}MB limit`,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!isPdfBuffer(buffer)) {
    return { error: "File must be a valid PDF" };
  }

  const key = resumeKeyForUser(userId);

  await s3.send(
    new PutObjectCommand({
      Bucket: RESUMES_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
      ContentLength: buffer.length,
    }),
  );

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: userId,
    event: "resume_uploaded",
    properties: { file_size_bytes: file.size, source: "web" },
  });
  await posthog.flush();

  return { key };
}

async function canDownloadResume(
  key: string,
  userId: string,
  role: string,
): Promise<boolean> {
  if (role === "organizer") return true;
  return resumeKeyBelongsToUser(key, userId);
}

// Called from client components, server components, and the admin review
// workspace (organizers viewing other users' resumes) — so `key` must never
// be trusted as-is. Identity (and role) is re-derived from the session here
// rather than taking a userId param, since a param can be passed wrong (or,
// if this were ever reachable from an untrusted caller, spoofed); re-deriving
// it means the check holds regardless of what the caller believes the key is.
export async function getResumeDownloadUrl(
  key: string,
  disposition: "inline" | "attachment" = "inline",
): Promise<string> {
  const user = await requireSessionUser();

  if (!(await canDownloadResume(key, user.id, user.role))) {
    throw new Error("Resume not found");
  }

  const command = new GetObjectCommand({
    Bucket: RESUMES_BUCKET,
    Key: key,
    ResponseContentDisposition:
      disposition === "attachment"
        ? 'attachment; filename="resume.pdf"'
        : 'inline; filename="resume.pdf"',
    ResponseContentType: "application/pdf",
  });
  return getSignedUrl(s3, command, {
    expiresIn: RESUME_DOWNLOAD_URL_TTL_SECONDS,
  });
}
