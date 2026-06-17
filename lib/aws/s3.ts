"use server";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const REGION = process.env.RESUMES_REGION ?? "us-east-1";
const BUCKET = process.env.RESUMES_BUCKET!;

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.RESUMES_ACCESS_KEYS_ID!,
    secretAccessKey: process.env.RESUMES_SECRET_ACCESS_KEY!,
  },
});

export async function getResumeUploadUrl(
  userId: string,
  fileName: string,
): Promise<{ uploadUrl: string; objectUrl: string }> {
  const sanitized = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const key = `resumes/${userId}/${Date.now()}-${sanitized}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: "application/pdf",
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  const objectUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

  return { uploadUrl, objectUrl };
}
