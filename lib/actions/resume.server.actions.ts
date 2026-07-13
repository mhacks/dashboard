"use server";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { eq, sql } from "drizzle-orm";
import { RESUMES_BUCKET, s3 } from "@/lib/aws/s3";
import { requireSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  hackerApplicants,
  hackerApplicationDrafts,
} from "@/lib/db/schema/applications";
import { users } from "@/lib/db/schema/users";

const MAX_RESUME_SIZE = 10 * 1024 * 1024;

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

  const [ownedResume] = await db
    .select({
      applicationId: hackerApplicants.id,
      draftUserId: hackerApplicationDrafts.userId,
    })
    .from(users)
    .leftJoin(
      hackerApplicants,
      sql`${hackerApplicants.userId} = ${users.id} and ${hackerApplicants.resume} = ${key}`,
    )
    .leftJoin(
      hackerApplicationDrafts,
      sql`${hackerApplicationDrafts.userId} = ${users.id} and ${hackerApplicationDrafts.data}->>'resume' = ${key}`,
    )
    .where(eq(users.id, user.id))
    .limit(1);

  return Boolean(ownedResume?.applicationId || ownedResume?.draftUserId);
}

export async function getResumeDownloadUrl(key: string): Promise<string> {
  if (!(await canDownloadResume(key))) throw new Error("Forbidden");

  const command = new GetObjectCommand({ Bucket: RESUMES_BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 86400 });
}
