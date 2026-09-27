import { recordRoleGranted } from "@/lib/actions/discord-link.actions";
import { verifyClaimSignature } from "@/lib/discord/claim-auth";
import { lookupDiscordMemberByDiscordId } from "@/lib/queries/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Discord bot asks who owns a Discord account and whether they may have a
 * role. Authenticated by HMAC, not by a session — the bot has no cookie and no
 * Supabase credential (see lib/discord/claim-auth.ts). This path is listed in
 * isPublicPath in lib/supabase/proxy.ts so the middleware doesn't redirect it to
 * /login; without that the bot gets a 307 and the claim silently never works.
 *
 * Read-only as far as the link goes: the member makes the link themselves on
 * /discord_auth. This only reports it back, and notes that a role was handed
 * over.
 */
const NO = new Response("Not found", {
  status: 404,
  headers: { "Cache-Control": "private, no-store" },
});

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
    // Deliberately indistinguishable from an unknown route: an unauthenticated
    // caller learns nothing about whether this endpoint exists.
    if (!ok) return NO;

    const body = JSON.parse(rawBody) as { discordId?: unknown };
    const discordId = body?.discordId;
    if (typeof discordId !== "string" || !discordId) return NO;

    const member = await lookupDiscordMemberByDiscordId(discordId);
    if (!member) return json({ status: "not_linked" });
    if (!member.eligible) return json({ status: "ineligible" });

    await recordRoleGranted({
      userId: member.userId,
      userEmail: member.email,
      discordUserId: discordId,
      role: member.role,
    });

    return json({
      status: "ok",
      role: member.role,
      fullName: member.fullName,
    });
  } catch (error) {
    console.error("discord claim failed", error);
    return NO;
  }
}
