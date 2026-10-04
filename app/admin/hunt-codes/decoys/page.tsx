import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { requireOrganizerPage } from "@/lib/auth/guards";
import { DECOY_LOCKOUT_MINUTES } from "@/lib/hunt/codes";
import { getHuntDecoyRoster } from "@/lib/queries/hunt";
import { DecoyList } from "./decoy-list";

export const dynamic = "force-dynamic";

/*
  Temporary. Its own page rather than a section of /admin/hunt-codes: that page
  is on screen in front of hackers whenever an organizer makes a code.
*/
export default async function HuntDecoysPage() {
  await requireOrganizerPage();
  const roster = await getHuntDecoyRoster();

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Hunt decoys"
        description={`Codes from a decoy look normal, but a hacker who enters one loses the organizer map for ${DECOY_LOCKOUT_MINUTES} minutes, and the code unlocks nothing.`}
      />
      <DecoyList roster={roster} />
    </AdminPageShell>
  );
}
