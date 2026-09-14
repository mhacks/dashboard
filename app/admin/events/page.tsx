import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { listEventsForAdmin } from "@/lib/queries/events";
import { EventsManager } from "./events-manager";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const events = await listEventsForAdmin();

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Events"
        description="Create the things you want to count attendance for — the main door, each meal, a workshop — and open or close their scanners."
      />
      <EventsManager events={events} />
    </AdminPageShell>
  );
}
