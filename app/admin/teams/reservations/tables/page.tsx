import {
  DEFAULT_MAP_COLUMNS,
  DEFAULT_MAP_ROWS,
} from "@/lib/reservation/domain";
import { getAdminReservationTables } from "@/lib/queries/admin-reservations";
import { getJudgingSettings } from "@/lib/queries/judging-settings";
import { TableManagement } from "./table-management";

export const dynamic = "force-dynamic";

export default async function ReservationTablesPage() {
  const [tables, settings] = await Promise.all([
    getAdminReservationTables(),
    getJudgingSettings(),
  ]);
  return (
    <TableManagement
      columns={settings?.mapColumns ?? DEFAULT_MAP_COLUMNS}
      rows={settings?.mapRows ?? DEFAULT_MAP_ROWS}
      tables={tables}
    />
  );
}
