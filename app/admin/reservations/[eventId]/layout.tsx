import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EyeIcon } from "lucide-react";
import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdminReservationEventHeader } from "@/lib/queries/admin-reservations";
import {
  RESERVATION_EVENT_STATUS_BADGE_VARIANTS,
  RESERVATION_EVENT_STATUS_LABELS,
} from "@/lib/reservation/domain";
import { ReservationEventNav } from "./reservation-event-nav";

export default async function ReservationEventLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await getAdminReservationEventHeader(eventId);
  if (!event) notFound();

  return (
    <AdminPageShell>
      <AdminPageHeader
        variant="workspace"
        title={event.name}
        actions={
          <>
            <Badge
              variant={RESERVATION_EVENT_STATUS_BADGE_VARIANTS[event.status]}
            >
              {RESERVATION_EVENT_STATUS_LABELS[event.status]}
            </Badge>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/reservations/${event.id}/preview`}>
                <EyeIcon data-icon="inline-start" />
                Preview participant view
              </Link>
            </Button>
          </>
        }
        footer={<ReservationEventNav eventId={event.id} />}
      />
      {children}
    </AdminPageShell>
  );
}
