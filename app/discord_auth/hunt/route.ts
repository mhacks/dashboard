import { verifyClaimSignature } from "@/lib/discord/claim-auth";
import {
  HUNT_REDEEM_ATTEMPTS,
  HUNT_REDEEM_WINDOW_SECONDS,
  normalizePetalCode,
} from "@/lib/hunt/codes";
import { lookupDiscordMemberByDiscordId } from "@/lib/queries/discord";
import {
  endHuntWithWinner,
  getPetalCode,
  isHuntEnded,
} from "@/lib/queries/hunt";
import { drizzleRateLimiter, rateLimitMessage } from "@/lib/rate-limit/drizzle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Discord bot's /submit-code: a hacker submits their final scavenger hunt
 * code, and the first to submit their own wins and ends the hunt (see
 * docs/puzzle-hunt.md). Authenticated by HMAC like /discord_auth/claim, and
 * listed in isPublicPath in lib/supabase/proxy.ts for the same reason.
 *
 * Only the code given to the Discord account's own dashboard user counts, so
 * a code passed along by a friend is just wrong.
 */
const NO = new Response("Not found", {
  status: 404,
  headers: { "Cache-Control": "private, no-store" },
});

/** Codes are 8 characters from 32; this only stops a script hammering it. */
const submitLimiter = drizzleRateLimiter(
  "hunt:submit",
  HUNT_REDEEM_ATTEMPTS,
  HUNT_REDEEM_WINDOW_SECONDS,
);

function json(body: unknown) {
  return Response.json(body, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  try {
    const secret = process.env.DISCORD_LINK_SECRET;
    if (!secret) {
      console.error("DISCORD_LINK_SECRET is not set");
      return NO;
    }

    const rawBody = await request.text();
    const ok = verifyClaimSignature({
      secret,
      rawBody,
      timestamp: request.headers.get("x-mhacks-timestamp"),
      signature: request.headers.get("x-mhacks-signature"),
    });
    if (!ok) return NO;

    const body = JSON.parse(rawBody) as { discordId?: unknown; code?: unknown };
    const discordId = body?.discordId;
    if (typeof discordId !== "string" || !discordId) return NO;
    if (typeof body.code !== "string") return NO;

    const member = await lookupDiscordMemberByDiscordId(discordId);
    if (!member) return json({ status: "not_linked" });
    if (!member.eligible) return json({ status: "ineligible" });

    if (await isHuntEnded()) return json({ status: "ended" });

    // Counted before checking, right or wrong, so guessing costs the same.
    if (await rateLimitMessage(submitLimiter, member.userId, "blocked")) {
      return json({ status: "rate_limited" });
    }

    const code = normalizePetalCode(body.code);
    const own = await getPetalCode(member.userId);
    if (!code || !own || code !== own) return json({ status: "wrong" });

    if (!(await endHuntWithWinner(member.userId))) {
      return json({ status: "ended" });
    }
    return json({ status: "won", fullName: member.fullName });
  } catch (error) {
    console.error("hunt code submission failed", error);
    return NO;
  }
}
