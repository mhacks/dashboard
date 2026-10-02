import { getAdminReservation } from "@/lib/queries/admin-reservations";
import { EventOverview } from "./event-overview";

export const dynamic = "force-dynamic";

export default async function AdminReservationsPage() {
  const reservation = await getAdminReservation();
  return <EventOverview event={reservation} />;
}
