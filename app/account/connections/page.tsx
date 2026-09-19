import { requireSessionUser } from "@/lib/auth/guards";
import { listGrants } from "@/lib/actions/oauth-grants.server.actions";
import { ConnectionsList } from "./connections-list";

// "Connected apps" — lists OAuth clients the user has approved via the
// /oauth/consent flow and lets them revoke access. See agents/mcp-auth.md §8.
export default async function ConnectionsPage() {
  await requireSessionUser();

  const grants = await listGrants();

  return <ConnectionsList grants={grants} />;
}
