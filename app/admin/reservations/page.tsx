import Link from "next/link";
import { ScrollTextIcon } from "lucide-react";
import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { Button } from "@/components/ui/button";
import { listAdminReservationEvents } from "@/lib/queries/admin-reservations";
import { ReservationEventList } from "./reservation-event-list";

export const dynamic = "force-dynamic";

export default async function AdminReservationsPage() {
  const events = await listAdminReservationEvents();

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Reservations"
        description="Create events, manage tables, and coordinate assignments."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/reservations/audit">
              <ScrollTextIcon data-icon="inline-start" />
              View audit log
            </Link>
          </Button>
        }
      />
      <ReservationEventList initialEvents={events} />
    </AdminPageShell>
  );
}
