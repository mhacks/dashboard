"use server";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const REGION = process.env.RESUMES_REGION ?? "us-east-2";
const BUCKET = process.env.RESUMES_BUCKET!;

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.RESUMES_ACCESS_KEY_ID!,
    secretAccessKey: process.env.RESUMES_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

// Returns a presigned PUT URL for the browser to upload directly to S3,
// and the S3 key to store in the database.
export async function getResumeUploadUrl(
  userId: string,
  fileName: string,
): Promise<{ uploadUrl: string; key: string }> {
  const sanitized = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const key = `resumes/${userId}/${Date.now()}-${sanitized}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: "application/pdf",
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return { uploadUrl, key };
}

// Generates a fresh presigned GET URL from a stored S3 key.
// Called at view time so the URL is always current.
export async function getResumeDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  // 7 days is the AWS maximum for presigned URLs with IAM credentials.
  return getSignedUrl(s3, command, { expiresIn: 604800 });
}
