import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listGrants } from "@/lib/actions/oauth-grants.server.actions";
import { ConnectionsList } from "./connections-list";

// "Connected apps" — lists OAuth clients the user has approved via the
// /oauth/consent flow and lets them revoke access. See agents/mcp-auth.md §8.
export default async function ConnectionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/account/connections")}`);
  }

  const grants = await listGrants();

  return <ConnectionsList grants={grants} />;
}
