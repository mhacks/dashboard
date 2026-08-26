import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ReservationBoard } from "@/components/reservation/reservation-board";
import {
  getTablesForEvent,
  toParticipantEvent,
} from "@/lib/db/queries/reservation";
import type { AdminReservationEventDetail } from "@/lib/queries/admin-reservations";
import { getAdminReservationEvent } from "@/lib/queries/admin-reservations";
import { getReservationAvailability } from "@/lib/reservation/domain";
import type { ParticipantEvent } from "@/lib/reservation/types";

export const dynamic = "force-dynamic";

function toPreviewEvent(event: AdminReservationEventDetail): ParticipantEvent {
  if (event.status === "open" || event.status === "closed") {
    return toParticipantEvent(event);
  }

  return {
    id: event.id,
    name: event.name,
    description: event.description,
    startsAt: event.startsAt,
    location: event.location,
    status: "closed",
    reservationsOpenAt: event.reservationsOpenAt,
    reservationsCloseAt: event.reservationsCloseAt,
    availability: getReservationAvailability(event),
  };
}

export default async function ReservationParticipantPreviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await getAdminReservationEvent(eventId);
  if (!event) notFound();

  const tables = await getTablesForEvent(eventId);
  const participantEvent = toPreviewEvent(event);

  return (
    <section
      aria-labelledby="participant-preview-heading"
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Preview</Badge>
          <Badge variant="outline">Organizer-only</Badge>
        </div>
        <div>
          <h2
            id="participant-preview-heading"
            className="font-heading text-xl font-medium"
          >
            Participant preview
          </h2>
          <p className="text-sm text-muted-foreground">
            This read-only preview mirrors the participant table map. No
            reservation actions are available here.
          </p>
        </div>
      </div>

      <ReservationBoard
        events={[participantEvent]}
        user={null}
        tables={tables}
        selectedEventId={eventId}
        readOnly
      />
    </section>
  );
}
