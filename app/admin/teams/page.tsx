import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { getAllTeamsForAdmin } from "@/lib/queries/admin-teams";
import { isTeamFormationEnabled } from "@/lib/queries/team-settings";
import { TeamFormationToggle } from "./team-formation-toggle";
import { TeamsView } from "./teams-view";

export const dynamic = "force-dynamic";

export default async function AdminTeamsPage() {
  const [teams, formationEnabled] = await Promise.all([
    getAllTeamsForAdmin(),
    isTeamFormationEnabled(),
  ]);

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Teams"
        description="Every team hackers have formed, who's on it, and any invites still pending. Turn formation on or off for accepted hackers."
        actions={<TeamFormationToggle enabled={formationEnabled} />}
      />
      <TeamsView teams={teams} />
    </AdminPageShell>
  );
}
