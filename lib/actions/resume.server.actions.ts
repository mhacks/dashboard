"use server";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { RESUMES_BUCKET, s3 } from "@/lib/aws/s3";
import { requireSessionUser } from "@/lib/auth/guards";
import {
  isAllowedResumeKey,
  isPdfBuffer,
  resumeKeyForUser,
} from "@/lib/resume";

const MAX_RESUME_SIZE = 10 * 1024 * 1024;
const RESUME_DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

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
  if (file.size > MAX_RESUME_SIZE) {
    return { error: "File exceeds 10 MB limit" };
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

  return { key };
}

async function canDownloadResume(key: string) {
  if (!isAllowedResumeKey(key)) return false;

  const user = await requireSessionUser();
  if (user.role === "organizer") return true;

  return key === resumeKeyForUser(user.id);
}

export async function getResumeDownloadUrl(
  key: string,
  disposition: "inline" | "attachment" = "inline",
): Promise<string> {
  if (!(await canDownloadResume(key))) throw new Error("Forbidden");

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
