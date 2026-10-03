import { getAllTeamsForAdmin } from "@/lib/queries/admin-teams";
import { TeamsView } from "./teams-view";

export const dynamic = "force-dynamic";

export default async function AdminTeamsPage() {
  const teams = await getAllTeamsForAdmin();

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-xl font-medium">Teams</h2>
      <TeamsView teams={teams} />
    </section>
  );
}
