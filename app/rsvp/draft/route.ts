import { saveRsvpDraft } from "@/lib/actions/rsvp.server.actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DRAFT_REQUEST_BYTES = 32 * 1024;
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const encoder = new TextEncoder();

export async function POST(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  if (request.headers.get("origin") !== requestUrl.origin) {
    return new Response("Forbidden", {
      status: 403,
      headers: PRIVATE_HEADERS,
    });
  }

  const body = await request.text();
  if (!body || encoder.encode(body).byteLength > MAX_DRAFT_REQUEST_BYTES) {
    return new Response("Invalid draft", {
      status: 413,
      headers: PRIVATE_HEADERS,
    });
  }

  try {
    await saveRsvpDraft(JSON.parse(body));
    return new Response(null, { status: 204, headers: PRIVATE_HEADERS });
  } catch {
    return new Response("Unable to save draft", {
      status: 409,
      headers: PRIVATE_HEADERS,
    });
  }
}
