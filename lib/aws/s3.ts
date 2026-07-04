"use server";

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const RESUMES_BUCKET = process.env.RESUMES_BUCKET!;

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

export async function getResumeUploadUrl(
  userId: string,
  fileName: string,
): Promise<{ uploadUrl: string; key: string }> {
  const sanitized = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const key = `resumes/${userId}/${Date.now()}-${sanitized}`;

  const command = new PutObjectCommand({
    Bucket: RESUMES_BUCKET,
    Key: key,
    ContentType: "application/pdf",
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return { uploadUrl, key };
}

export async function getResumeDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: RESUMES_BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 604800 });
}
