import { createRsvpReceiptDownloadResponse } from "@/lib/rsvp/download";
import { getAdminRsvpReceipt } from "@/lib/queries/admin-rsvps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_FOUND_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ applicationSlug: string }> },
): Promise<Response> {
  try {
    const { applicationSlug } = await params;
    const receipt = await getAdminRsvpReceipt(applicationSlug);
    if (!receipt) {
      return new Response("Receipt not found", {
        status: 404,
        headers: NOT_FOUND_HEADERS,
      });
    }
    return await createRsvpReceiptDownloadResponse(receipt);
  } catch {
    return new Response("Receipt not found", {
      status: 404,
      headers: NOT_FOUND_HEADERS,
    });
  }
}
