"use server";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { RESUMES_BUCKET, s3 } from "@/lib/aws/s3";
import { requireSessionUser } from "@/lib/auth/guards";

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

  const key = `resumes/${userId}.pdf`;
  const buffer = Buffer.from(await file.arrayBuffer());

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
  const user = await requireSessionUser();

  if (user.role === "organizer") return true;

  return key === `resumes/${user.id}.pdf`;
}

export async function getResumeDownloadUrl(key: string): Promise<string> {
  if (!(await canDownloadResume(key))) throw new Error("Forbidden");

  const command = new GetObjectCommand({ Bucket: RESUMES_BUCKET, Key: key });
  return getSignedUrl(s3, command, {
    expiresIn: RESUME_DOWNLOAD_URL_TTL_SECONDS,
  });
}
