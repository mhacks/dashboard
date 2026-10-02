import { JudgingMap } from "@/app/dashboard/team/judging-map";
import { getAdminReservationTables } from "@/lib/queries/admin-reservations";

export const dynamic = "force-dynamic";

export default async function ReservationPreviewPage() {
  const tables = await getAdminReservationTables();

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
        selectedTableId={null}
        teamId={null}
        onSelect={() => {}}
        disabled
      />
    </section>
  );
}
