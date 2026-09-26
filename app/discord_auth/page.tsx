import { requireSessionUser } from "@/lib/auth/guards";
import { currentDiscordLink } from "@/lib/actions/discord-link.actions";
import { open } from "@/lib/discord/link-token";
import { DiscordLinkConfirm } from "./discord-link-confirm";

/**
 * Where the Discord bot's Verify button sends a member. The `t` parameter is a
 * sealed token carrying the Discord account that asked; see lib/discord/link-token.ts.
 *
 * Signing in is not handled here on purpose. This path is not in isPublicPath
 * (lib/supabase/proxy.ts), so the middleware already bounces an anonymous
 * visitor to /login?next=/discord_auth?t=... and verifyOtp lands them back here
 * with the token intact.
 *
 * Nothing is written on GET. A crawler, a link preview or a prefetch would
 * otherwise link whichever account happened to be signed in.
 */
export default async function DiscordAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const user = await requireSessionUser();
  const { t } = await searchParams;

  const secret = process.env.DISCORD_LINK_SECRET;
  if (!secret) {
    console.error("DISCORD_LINK_SECRET is not set");
    return <DiscordLinkConfirm state={{ kind: "misconfigured" }} />;
  }

  const opened = t
    ? open(secret, t)
    : ({ ok: false, reason: "malformed" } as const);
  if (!opened.ok) {
    return (
      <DiscordLinkConfirm state={{ kind: "invalid", reason: opened.reason }} />
    );
  }

  const existing = await currentDiscordLink(user.id);

  return (
    <DiscordLinkConfirm
      state={{
        kind: "confirm",
        token: t!,
        email: user.email,
        discordUsername: opened.payload.u,
        discordUserId: opened.payload.d,
        existing:
          existing && existing.discordUserId !== opened.payload.d
            ? { discordUsername: existing.discordUsername }
            : null,
      }}
    />
  );
}
