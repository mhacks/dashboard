"use server";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOrganizer } from "@/lib/auth/guards";
import { UPLOADS_BUCKET, s3 } from "@/lib/aws/s3";
import type { ApplicationDecision } from "@/lib/decisions";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { hackerRsvps } from "@/lib/db/schema/rsvps";
import {
  getAdminRsvpDetail,
  getAdminRsvpReceipt,
} from "@/lib/queries/admin-rsvps";
import { contentDispositionForReceipt } from "@/lib/rsvp/receipt";
import { deleteRsvpReceipt, validateRsvpReceiptInS3 } from "@/lib/rsvp/storage";
import { applicationSlugSchema } from "@/lib/types/application-reviews";
import type { AdminRsvpDetail } from "@/lib/types/admin-rsvps";

const ADMIN_RSVP_RECEIPT_URL_TTL_SECONDS = 15 * 60;
const RSVP_ELIGIBLE_DECISIONS = [
  "early_accepted",
  "early_rsvped",
  "regular_accepted",
  "regular_rsvped",
] as const satisfies readonly ApplicationDecision[];

const deleteAdminRsvpInputSchema = z.strictObject({
  slug: applicationSlugSchema,
  confirmationName: z.string().trim().min(1),
});

const applicationSlugSql = sql<string>`'app_' || substring(md5(${hackerApplicants.userId}::text) from 1 for 24)`;

export type DeleteAdminRsvpResult =
  { ok: true; applicationName: string } | { ok: false; message: string };

function parseApplicationSlug(slug: unknown): string | null {
  const parsed = applicationSlugSchema.safeParse(slug);
  if (!parsed.success) return null;
  return parsed.data;
}

function acceptedDecision(decision: ApplicationDecision): ApplicationDecision {
  if (decision === "early_rsvped") return "early_accepted";
  if (decision === "regular_rsvped") return "regular_accepted";
  return decision;
}

export async function getAdminRsvpDetailAction(
  slug: string,
): Promise<AdminRsvpDetail | null> {
  await requireOrganizer();
  const applicationSlug = parseApplicationSlug(slug);
  return applicationSlug ? getAdminRsvpDetail(applicationSlug) : null;
}

export async function getAdminRsvpReceiptDownloadUrl(
  slug: string,
): Promise<string | null> {
  await requireOrganizer();
  const applicationSlug = parseApplicationSlug(slug);
  if (!applicationSlug) return null;
  const receipt = await getAdminRsvpReceipt(applicationSlug);
  if (!receipt) return null;

  try {
    await validateRsvpReceiptInS3({
      key: receipt.key,
      userId: receipt.userId,
      expectedContentType: receipt.contentType,
      expectedSizeBytes: receipt.sizeBytes,
    });

    return await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: UPLOADS_BUCKET,
        Key: receipt.key,
        ResponseContentDisposition: contentDispositionForReceipt(
          receipt.originalName,
        ),
        ResponseContentType: receipt.contentType,
      }),
      { expiresIn: ADMIN_RSVP_RECEIPT_URL_TTL_SECONDS },
    );
  } catch (error) {
    console.error("Unable to create admin RSVP receipt download URL:", error);
    return null;
  }
}

export async function deleteAdminRsvpAction(
  input: unknown,
): Promise<DeleteAdminRsvpResult> {
  await requireOrganizer();
  const parsed = deleteAdminRsvpInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Enter the applicant name to confirm." };
  }

  const { slug, confirmationName } = parsed.data;
  const result = await db.transaction(async (tx) => {
    const [target] = await tx
      .select({
        applicationId: hackerApplicants.id,
        applicationName: sql<string>`trim(${hackerApplicants.firstName} || ' ' || ${hackerApplicants.lastName})`,
        decision: hackerApplicants.decision,
        receiptKey: hackerRsvps.receiptKey,
      })
      .from(hackerApplicants)
      .innerJoin(
        hackerRsvps,
        eq(hackerRsvps.applicationId, hackerApplicants.id),
      )
      .where(
        and(
          eq(applicationSlugSql, slug),
          inArray(hackerApplicants.decision, RSVP_ELIGIBLE_DECISIONS),
        ),
      )
      .for("update")
      .limit(1);

    if (!target) {
      return {
        ok: false as const,
        message: "This applicant does not have a submitted RSVP.",
      };
    }

    if (confirmationName !== target.applicationName) {
      return {
        ok: false as const,
        message: `Type ${target.applicationName} to confirm deletion.`,
      };
    }

    await tx
      .delete(hackerRsvps)
      .where(eq(hackerRsvps.applicationId, target.applicationId));

    await tx
      .update(hackerApplicants)
      .set({
        decision: acceptedDecision(target.decision),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(hackerApplicants.id, target.applicationId));

    return {
      ok: true as const,
      applicationName: target.applicationName,
      receiptKey: target.receiptKey,
    };
  });

  if (result.ok && result.receiptKey) {
    try {
      await deleteRsvpReceipt(result.receiptKey);
    } catch (error) {
      console.error("Unable to delete admin-removed RSVP receipt:", error);
    }
  }

  if (result.ok) {
    revalidatePath("/admin/rsvps");
    revalidatePath(`/admin/rsvps/${slug}`);
    return {
      ok: true,
      applicationName: result.applicationName,
    };
  }

  return result;
}
