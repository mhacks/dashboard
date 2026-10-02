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
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-medium">Teams</h2>
        <TeamFormationToggle enabled={formationEnabled} />
      </div>
      <TeamsView teams={teams} />
    </section>
  );
}
