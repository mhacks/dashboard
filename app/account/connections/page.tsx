import { requireSessionUser } from "@/lib/auth/guards";
import { currentDiscordLink } from "@/lib/actions/discord-link.actions";
import { listGrants } from "@/lib/actions/oauth-grants.server.actions";
import { ConnectionsList } from "./connections-list";

// "Connected apps" — lists OAuth clients the user has approved via the
// /oauth/consent flow and lets them revoke access. See agents/mcp-auth.md §8.
// Also shows the Discord account linked through /discord_auth, so a member who
// linked it to the wrong MHacks account can undo that themselves.
export default async function ConnectionsPage() {
  const user = await requireSessionUser();

  const [grants, discord] = await Promise.all([
    listGrants(),
    currentDiscordLink(user.id),
  ]);

  return (
    <ConnectionsList
      grants={grants}
      discord={discord && { discordUsername: discord.discordUsername }}
    />
  );
}
