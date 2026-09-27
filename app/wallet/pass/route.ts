import type { NextRequest } from "next/server";

import { getRequestOrigin } from "@/lib/url/request-origin";
import { isAppleWalletConfigured } from "@/lib/wallet/config";
import { buildCheckInPass } from "@/lib/wallet/pass";
import {
  NO_STORE,
  recordWalletEvent,
  resolveWalletRequest,
  walletTextResponse,
} from "@/lib/wallet/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves the signed .pkpass, to the emailed-token or signed-in attendee (see
 * resolveWalletRequest).
 */
export async function GET(request: NextRequest): Promise<Response> {
  if (!isAppleWalletConfigured()) {
    return walletTextResponse("Wallet passes aren't available right now.", 503);
  }

  try {
    const resolved = await resolveWalletRequest(request, {
      path: "/wallet/pass",
      label: "Wallet",
    });
    if ("response" in resolved) return resolved.response;

    const pass = await buildCheckInPass({
      userId: resolved.userId,
      firstName: resolved.holder.firstName,
      lastName: resolved.holder.lastName,
      origin: await getRequestOrigin(),
    });

    recordWalletEvent(resolved.userId, "wallet_pass_downloaded", resolved.via);

    return new Response(new Uint8Array(pass), {
      headers: {
        ...NO_STORE,
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": 'attachment; filename="mhacks-2026.pkpass"',
      },
    });
  } catch (error) {
    console.error("Unable to build wallet pass:", error);
    return walletTextResponse(
      "We couldn't create your Wallet pass. Try again.",
      500,
    );
  }
}
