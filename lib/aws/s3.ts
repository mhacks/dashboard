"use server";

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env.RESUMES_ENDPOINT;

export const RESUMES_BUCKET = process.env.RESUMES_BUCKET!;

export const s3 = new S3Client({
  region: process.env.RESUMES_REGION ?? "us-east-2",
  ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  credentials: {
    accessKeyId: process.env.RESUMES_ACCESS_KEY_ID!,
    secretAccessKey: process.env.RESUMES_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
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
