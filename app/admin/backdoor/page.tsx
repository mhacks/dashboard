import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { getAdminApplicationInvitations } from "@/lib/queries/application-invitations";
import { getAdminRsvpExceptions } from "@/lib/queries/rsvp-exceptions";
import { BackdoorControls } from "./backdoor-controls";
import { HackerInviteControls } from "./hacker-invite-controls";

export const dynamic = "force-dynamic";

export default async function AdminBackdoorPage() {
  const [invitations, exceptions] = await Promise.all([
    getAdminApplicationInvitations(),
    getAdminRsvpExceptions(),
  ]);

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Backdoor"
        description="Invite late applicants and create short RSVP windows after the standard deadlines."
      />
      <HackerInviteControls initialInvitations={invitations} />
      <BackdoorControls initialExceptions={exceptions} />
    </AdminPageShell>
  );
}
