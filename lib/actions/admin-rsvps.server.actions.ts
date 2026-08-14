"use server";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { requireOrganizer } from "@/lib/auth/guards";
import { RESUMES_BUCKET, s3 } from "@/lib/aws/s3";
import {
  getAdminRsvpDetail,
  getAdminRsvpReceipt,
} from "@/lib/queries/admin-rsvps";
import { contentDispositionForReceipt } from "@/lib/rsvp/receipt";
import { validateRsvpReceiptInS3 } from "@/lib/rsvp/storage";
import { applicationSlugSchema } from "@/lib/types/application-reviews";
import type { AdminRsvpDetail } from "@/lib/types/admin-rsvps";

const ADMIN_RSVP_RECEIPT_URL_TTL_SECONDS = 15 * 60;

function parseApplicationSlug(slug: unknown): string | null {
  const parsed = applicationSlugSchema.safeParse(slug);
  if (!parsed.success) return null;
  return parsed.data;
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
        Bucket: RESUMES_BUCKET,
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
