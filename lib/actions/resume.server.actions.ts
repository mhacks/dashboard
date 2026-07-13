"use server";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { eq, sql } from "drizzle-orm";
import { RESUMES_BUCKET, s3 } from "@/lib/aws/s3";
import { requireSessionUser } from "@/lib/auth/guards";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  hackerApplicants,
  hackerApplicationDrafts,
} from "@/lib/db/schema/applications";
import { users } from "@/lib/db/schema/users";

export async function getResumeUploadUrl(
  userId: string,
  fileName: string,
): Promise<{ uploadUrl: string; key: string }> {
  const user = await requireSessionUser();
  if (user.id !== userId) throw new Error("Forbidden");

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

async function canDownloadResume(key: string) {
  const user = await getSessionUser();
  if (!user) return false;

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
  return getSignedUrl(s3, command, { expiresIn: 604800 });
}
