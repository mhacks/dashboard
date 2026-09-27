"use server";

import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth/guards";
import {
  linkDiscordAccount,
  unlinkDiscordAccount,
} from "@/lib/actions/discord-link.actions";
import { open } from "@/lib/discord/link-token";
import { isDiscordEligible } from "@/lib/queries/discord";

export type DiscordLinkResult =
  { ok: true; discordUsername: string } | { ok: false; error: string };

const CONTACT = "email hackathon@mhacks.org";

const INELIGIBLE = `This MHacks account can't link Discord — only hackers who have RSVP'd and MHacks staff can. If you signed in with the wrong email, sign out and use the one you applied with. Otherwise, ${CONTACT}.`;

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

  if (!(await isDiscordEligible(user.id))) {
    return { ok: false, error: INELIGIBLE };
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
      error: `That Discord account is already linked to a different MHacks account. If that account is yours, sign in to it, unlink Discord at mhacks.org/account/connections, then try again. Otherwise, ${CONTACT}.`,
    };
  }

  revalidatePath("/account/connections");
  return { ok: true, discordUsername: opened.payload.u };
}

/** Unlinks the signed-in account's Discord, if it has one. */
export async function unlinkDiscord(): Promise<void> {
  const user = await requireSessionUser();
  await unlinkDiscordAccount({ userId: user.id, userEmail: user.email });
  revalidatePath("/account/connections");
}
