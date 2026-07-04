import { S3Client } from "@aws-sdk/client-s3";

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
