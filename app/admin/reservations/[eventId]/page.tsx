import { notFound } from "next/navigation";
import { getAdminReservationEvent } from "@/lib/queries/admin-reservations";
import { EventOverview } from "./event-overview";

export const dynamic = "force-dynamic";

export default async function ReservationEventOverviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await getAdminReservationEvent(eventId);
  if (!event) notFound();

  return <EventOverview event={event} />;
}
