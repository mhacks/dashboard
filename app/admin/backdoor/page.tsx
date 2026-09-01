import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { getAdminRsvpExceptions } from "@/lib/queries/rsvp-exceptions";
import { BackdoorControls } from "./backdoor-controls";

export const dynamic = "force-dynamic";

export default async function AdminBackdoorPage() {
  const exceptions = await getAdminRsvpExceptions();

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Backdoor"
        description="Create short RSVP windows for accepted applicants after the standard deadline."
      />
      <BackdoorControls initialExceptions={exceptions} />
    </AdminPageShell>
  );
}
