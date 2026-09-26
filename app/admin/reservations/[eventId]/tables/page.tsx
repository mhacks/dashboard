import { notFound } from "next/navigation";
import { getAdminReservationTables } from "@/lib/queries/admin-reservations";
import { TableManagement } from "./table-management";

export default async function ReservationTablesPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const data = await getAdminReservationTables(eventId);

  if (!data) notFound();

  return <TableManagement event={data.event} tables={data.tables} />;
}
