import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { getAllTeamsForAdmin } from "@/lib/queries/admin-teams";
import { TeamsView } from "./teams-view";

export const dynamic = "force-dynamic";

export default async function AdminTeamsPage() {
  const teams = await getAllTeamsForAdmin();

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Teams"
        description="Every team hackers have formed, who's on it, and any invites still pending."
      />
      <TeamsView teams={teams} />
    </AdminPageShell>
  );
}
