"use server";

import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth/guards";
import { linkDiscordAccount } from "@/lib/actions/discord-link.actions";
import { open } from "@/lib/discord/link-token";

export type DiscordLinkResult =
  { ok: true; discordUsername: string } | { ok: false; error: string };

const CONTACT = "email hackathon@mhacks.org";

/**
 * Confirms the link the Discord bot asked for. The token is the only thing
 * carrying the Discord identity — the browser never tells us which Discord
 * account this is, so a member cannot aim the link at an account they don't
 * control without forging a token they have no key for.
 *
 * Re-opened here rather than trusted from the page's props: a server action is
 * its own entry point, and anything the client hands back is the client's word.
 */
export async function confirmDiscordLink(
  token: string,
): Promise<DiscordLinkResult> {
  const user = await requireSessionUser();

  const secret = process.env.DISCORD_LINK_SECRET;
  if (!secret) {
    console.error("DISCORD_LINK_SECRET is not set");
    return { ok: false, error: "Server configuration error." };
  }

  const opened = open(secret, token);
  if (!opened.ok) {
    return {
      ok: false,
      error:
        opened.reason === "expired"
          ? "That link has expired. Go back to Discord and click Verify for a new one."
          : "That link isn't valid. Go back to Discord and click Verify for a new one.",
    };
  }

  const outcome = await linkDiscordAccount({
    userId: user.id,
    userEmail: user.email,
    discordUserId: opened.payload.d,
    discordUsername: opened.payload.u,
  });

  if (!outcome.ok) {
    return {
      ok: false,
      error: `That Discord account is already linked to a different MHacks account. If that shouldn't be the case, ${CONTACT}.`,
    };
  }

  revalidatePath("/account/connections");
  return { ok: true, discordUsername: opened.payload.u };
}
