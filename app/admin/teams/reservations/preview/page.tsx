import { JudgingMap } from "@/app/dashboard/team/judging-map";
import {
  DEFAULT_MAP_COLUMNS,
  DEFAULT_MAP_ROWS,
} from "@/lib/reservation/domain";
import { getAdminReservationTables } from "@/lib/queries/admin-reservations";
import { getJudgingSettings } from "@/lib/queries/judging-settings";

export const dynamic = "force-dynamic";

export default async function ReservationPreviewPage() {
  const [tables, settings] = await Promise.all([
    getAdminReservationTables(),
    getJudgingSettings(),
  ]);

  return (
    <section
      aria-labelledby="participant-preview-heading"
      className="flex flex-col gap-5"
    >
      <div>
        <h2
          id="participant-preview-heading"
          className="font-heading text-xl font-medium"
        >
          Participant preview
        </h2>
        <p className="text-sm text-muted-foreground">
          This read-only preview mirrors the participant table map.
        </p>
      </div>
      <JudgingMap
        tables={tables}
        columns={settings?.mapColumns ?? DEFAULT_MAP_COLUMNS}
        rows={settings?.mapRows ?? DEFAULT_MAP_ROWS}
        selectedTableId={null}
        teamId={null}
        onSelect={() => {}}
        disabled
      />
    </section>
  );
}
