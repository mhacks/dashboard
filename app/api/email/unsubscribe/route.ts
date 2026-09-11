import { NextResponse } from "next/server";
import { unsubscribeSignedEmailPreference } from "@/lib/email/preferences";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const signature = url.searchParams.get("sig") ?? "";
  const body = new URLSearchParams(await request.text());

  if (body.get("List-Unsubscribe") !== "One-Click") {
    return response("Invalid one-click unsubscribe request.", 400);
  }

  const preference = await unsubscribeSignedEmailPreference(
    id,
    signature,
    "one_click",
  );

  if (!preference) {
    return response("Invalid unsubscribe link.", 400);
  }

  return response("Unsubscribed.", 200);
}

function response(message: string, status: number) {
  return new NextResponse(message, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
