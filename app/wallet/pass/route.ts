import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { getPostHogClient } from "@/lib/posthog-server";
import { getRequestOrigin } from "@/lib/url/request-origin";
import { isWalletConfigured } from "@/lib/wallet/config";
import { getWalletPassHolder } from "@/lib/wallet/eligibility";
import { verifyWalletLinkToken } from "@/lib/wallet/link-token";
import { buildCheckInPass } from "@/lib/wallet/pass";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

function textResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * Serves the signed .pkpass. Two ways in:
 *
 *   ?t=<token>  the emailed link — no session needed (lib/wallet/link-token.ts)
 *   no token    the dashboard button — the signed-in user's own pass
 *
 * Listed as public in lib/supabase/proxy.ts so an emailed link isn't bounced to
 * /login before its token is read; this handler does all of its own auth.
 */
export async function GET(request: NextRequest): Promise<Response> {
  if (!isWalletConfigured()) {
    return textResponse("Wallet passes aren't available right now.", 503);
  }

  const token = request.nextUrl.searchParams.get("t");
  let userId: string | null;

  if (token) {
    userId = verifyWalletLinkToken(token);
    if (!userId) {
      return textResponse(
        "This Wallet link is invalid or has expired. Sign in to your MHacks dashboard to add your pass.",
        403,
      );
    }
  } else {
    userId = (await getSessionUser())?.id ?? null;
    if (!userId) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", "/wallet/pass");
      return NextResponse.redirect(login);
    }
  }

  try {
    const holder = await getWalletPassHolder(userId);
    if (!holder) {
      return textResponse(
        "Wallet passes are available once you have RSVPed to MHacks.",
        403,
      );
    }

    const pass = await buildCheckInPass({
      userId,
      firstName: holder.firstName,
      lastName: holder.lastName,
      origin: await getRequestOrigin(),
    });

    try {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: userId,
        event: "wallet_pass_downloaded",
        properties: { via: token ? "email" : "dashboard" },
      });
      await posthog.flush();
    } catch (error) {
      console.error("Unable to record wallet pass download:", error);
    }

    return new Response(new Uint8Array(pass), {
      headers: {
        ...NO_STORE,
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": 'attachment; filename="mhacks-2026.pkpass"',
      },
    });
  } catch (error) {
    console.error("Unable to build wallet pass:", error);
    return textResponse("We couldn't create your Wallet pass. Try again.", 500);
  }
}
