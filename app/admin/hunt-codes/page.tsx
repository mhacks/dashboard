import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { requireOrganizerPage } from "@/lib/auth/guards";
import { HUNT_CODE_TTL_MINUTES } from "@/lib/hunt/codes";
import { getIssuedHuntCodes } from "@/lib/queries/hunt";
import { HuntCodePanel } from "./hunt-code-panel";

// Shows whether codes have been used yet.
export const dynamic = "force-dynamic";

export default async function HuntCodesPage() {
  const organizer = await requireOrganizerPage();
  const issued = await getIssuedHuntCodes(organizer.id);

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Hunt codes"
        description={`When a hacker finds you for the puzzle hunt, make them a code. Each one works once, for ${HUNT_CODE_TTL_MINUTES} minutes.`}
      />
      <HuntCodePanel issued={issued} />
    </AdminPageShell>
  );
}
