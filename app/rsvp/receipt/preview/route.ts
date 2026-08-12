import { eq } from "drizzle-orm";

import { requireSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { hackerRsvpDrafts } from "@/lib/db/schema/rsvps";
import { createRsvpReceiptDownloadResponse } from "@/lib/rsvp/download";
import { isRsvpReceiptContentType } from "@/lib/rsvp/receipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_FOUND_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(): Promise<Response> {
  try {
    const user = await requireSessionUser();
    const [draft] = await db
      .select({
        key: hackerRsvpDrafts.receiptKey,
        originalName: hackerRsvpDrafts.receiptOriginalName,
        contentType: hackerRsvpDrafts.receiptContentType,
        sizeBytes: hackerRsvpDrafts.receiptSizeBytes,
      })
      .from(hackerRsvpDrafts)
      .where(eq(hackerRsvpDrafts.userId, user.id))
      .limit(1);

    if (
      !draft?.key ||
      !draft.originalName ||
      !draft.contentType ||
      !isRsvpReceiptContentType(draft.contentType) ||
      !draft.sizeBytes
    ) {
      return new Response("Receipt not found", {
        status: 404,
        headers: NOT_FOUND_HEADERS,
      });
    }

    return await createRsvpReceiptDownloadResponse(
      {
        key: draft.key,
        userId: user.id,
        originalName: draft.originalName,
        contentType: draft.contentType,
        sizeBytes: draft.sizeBytes,
      },
      { disposition: "inline" },
    );
  } catch {
    return new Response("Receipt not found", {
      status: 404,
      headers: NOT_FOUND_HEADERS,
    });
  }
}
