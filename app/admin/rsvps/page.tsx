import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { getAdminRsvpDashboard } from "@/lib/queries/admin-rsvps";
import { RsvpResponses } from "./rsvp-responses";

export const dynamic = "force-dynamic";

export default async function AdminRsvpsPage() {
  const dashboard = await getAdminRsvpDashboard();

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="RSVP Responses"
        description="Track every applicant's RSVP progress, review submitted logistics, and export responses."
      />
      <RsvpResponses dashboard={dashboard} />
    </AdminPageShell>
  );
}
