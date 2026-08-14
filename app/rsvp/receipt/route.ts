import { eq } from "drizzle-orm";

import { requireSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { hackerRsvps } from "@/lib/db/schema/rsvps";
import { createRsvpReceiptDownloadResponse } from "@/lib/rsvp/download";
import { isRsvpReceiptContentType } from "@/lib/rsvp/receipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_FOUND_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(): Promise<Response> {
  try {
    const user = await requireSessionUser();
    const [rsvp] = await db
      .select({
        key: hackerRsvps.receiptKey,
        originalName: hackerRsvps.receiptOriginalName,
        contentType: hackerRsvps.receiptContentType,
        sizeBytes: hackerRsvps.receiptSizeBytes,
      })
      .from(hackerRsvps)
      .where(eq(hackerRsvps.userId, user.id))
      .limit(1);

    if (
      !rsvp?.key ||
      !rsvp.originalName ||
      !rsvp.contentType ||
      !isRsvpReceiptContentType(rsvp.contentType) ||
      !rsvp.sizeBytes
    ) {
      return new Response("Receipt not found", {
        status: 404,
        headers: NOT_FOUND_HEADERS,
      });
    }

    return await createRsvpReceiptDownloadResponse({
      key: rsvp.key,
      userId: user.id,
      originalName: rsvp.originalName,
      contentType: rsvp.contentType,
      sizeBytes: rsvp.sizeBytes,
    });
  } catch {
    return new Response("Receipt not found", {
      status: 404,
      headers: NOT_FOUND_HEADERS,
    });
  }
}
