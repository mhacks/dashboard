import { getAdminReservationTables } from "@/lib/queries/admin-reservations";
import { TableManagement } from "./table-management";

export const dynamic = "force-dynamic";

export default async function ReservationTablesPage() {
  const tables = await getAdminReservationTables();
  return <TableManagement tables={tables} />;
}
