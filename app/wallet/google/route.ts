import { NextResponse, type NextRequest } from "next/server";

import { getRequestOrigin } from "@/lib/url/request-origin";
import { isGoogleWalletConfigured } from "@/lib/wallet/google-config";
import { buildGoogleWalletSaveUrl } from "@/lib/wallet/google-pass";
import {
  NO_STORE,
  recordWalletEvent,
  resolveWalletRequest,
  walletTextResponse,
} from "@/lib/wallet/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Provisions the signed-in (or emailed-token) attendee's Google Wallet object,
 * then redirects to Google's Save flow. All credentials and pass writes stay
 * server-side; the browser only receives Google's signed URL.
 */
export async function GET(request: NextRequest): Promise<Response> {
  if (!isGoogleWalletConfigured()) {
    return walletTextResponse(
      "Google Wallet passes aren't available right now.",
      503,
    );
  }

  try {
    const resolved = await resolveWalletRequest(request, {
      path: "/wallet/google",
      label: "Google Wallet",
    });
    if ("response" in resolved) return resolved.response;

    const saveUrl = await buildGoogleWalletSaveUrl({
      userId: resolved.userId,
      firstName: resolved.holder.firstName,
      lastName: resolved.holder.lastName,
      origin: await getRequestOrigin(),
    });

    recordWalletEvent(
      resolved.userId,
      "google_wallet_pass_opened",
      resolved.via,
    );

    const response = NextResponse.redirect(saveUrl, 303);
    response.headers.set("Cache-Control", NO_STORE["Cache-Control"]);
    return response;
  } catch (error) {
    console.error("Unable to build Google Wallet pass:", error);
    return walletTextResponse(
      "We couldn't create your Google Wallet pass. Try again.",
      500,
    );
  }
}
