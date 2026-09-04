import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EyeIcon } from "lucide-react";
import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdminReservationEvent } from "@/lib/queries/admin-reservations";
import type { ReservationEventStatus } from "@/lib/reservation/domain";
import { ReservationEventNav } from "./reservation-event-nav";

const STATUS_LABELS: Record<ReservationEventStatus, string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
  archived: "Archived",
};

const STATUS_VARIANTS: Record<
  ReservationEventStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  open: "default",
  closed: "secondary",
  archived: "destructive",
};

export default async function ReservationEventLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await getAdminReservationEvent(eventId);
  if (!event) notFound();

  return (
    <AdminPageShell>
      <AdminPageHeader
        variant="workspace"
        title={event.name}
        actions={
          <>
            <Badge variant={STATUS_VARIANTS[event.status]}>
              {STATUS_LABELS[event.status]}
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
