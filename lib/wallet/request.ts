import "server-only";

import { after, NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { getPostHogClient } from "@/lib/posthog-server";
import { getCheckInCodeHolder } from "@/lib/queries/check-in";
import { getRequestOrigin } from "@/lib/url/request-origin";
import { verifyWalletLinkToken } from "@/lib/wallet/link-token";

export const NO_STORE = { "Cache-Control": "private, no-store" };

export function walletTextResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" },
  });
}

type WalletRequest =
  | {
      userId: string;
      holder: NonNullable<Awaited<ReturnType<typeof getCheckInCodeHolder>>>;
      via: "email" | "dashboard";
    }
  | { response: Response };

/**
 * Who a Wallet pass route is serving. Two ways in:
 *
 *   ?t=<token>  the emailed link — no session needed (lib/wallet/link-token.ts)
 *   no token    the dashboard button — the signed-in user's own pass
 *
 * A token that doesn't verify falls back to the session, so an old link still
 * works for someone already signed in. Both routes are listed as public in
 * lib/supabase/proxy.ts, so this does all of their auth. Eligibility is
 * re-checked on every request, so an RSVP that is later deleted can't be
 * turned into a pass with an old emailed link.
 *
 * Returns `{ response }` when there's no one to serve. Throws if the
 * eligibility query fails; the route turns that into a 500, not a silent 403.
 */
export async function resolveWalletRequest(
  request: NextRequest,
  { path, label }: { path: string; label: string },
): Promise<WalletRequest> {
  // An RSC fetch is the router trying to navigate here client-side, which
  // can't use a pass or a redirect to Google anyway. After sign-in it happens
  // twice (the server action fetches its redirect target, then the client
  // router does) before the real page load. An empty non-RSC answer makes the
  // router fall back to that one full load, so the pass is built only once.
  if (request.headers.has("rsc")) {
    return { response: new Response(null, { status: 204, headers: NO_STORE }) };
  }

  const token = request.nextUrl.searchParams.get("t");
  const tokenUserId = token ? verifyWalletLinkToken(token) : null;
  const userId = tokenUserId ?? (await getSessionUser())?.id ?? null;

  if (!userId) {
    if (token) {
      return {
        response: walletTextResponse(
          `This ${label} link is invalid or has expired. Sign in to your MHacks dashboard to add your pass.`,
          403,
        ),
      };
    }
    const login = new URL("/login", await getRequestOrigin());
    login.searchParams.set("next", path);
    return { response: NextResponse.redirect(login) };
  }

  const holder = await getCheckInCodeHolder(userId);
  if (!holder) {
    return {
      response: walletTextResponse(
        `${label} passes are available once you have RSVPed to MHacks.`,
        403,
      ),
    };
  }

  return { userId, holder, via: tokenUserId ? "email" : "dashboard" };
}

/** Records the event after the response is sent, so analytics never delays a pass. */
export function recordWalletEvent(
  userId: string,
  event: string,
  via: "email" | "dashboard",
) {
  after(async () => {
    try {
      const posthog = getPostHogClient();
      posthog.capture({ distinctId: userId, event, properties: { via } });
      await posthog.flush();
    } catch (error) {
      console.error(`Unable to record ${event}:`, error);
    }
  });
}
