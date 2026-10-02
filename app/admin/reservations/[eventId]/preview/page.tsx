import { notFound } from "next/navigation";
import { JudgingMap } from "@/app/dashboard/team/judging-map";
import { Badge } from "@/components/ui/badge";
import { getAdminReservationTables } from "@/lib/queries/admin-reservations";

export const dynamic = "force-dynamic";

export default async function ReservationParticipantPreviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const data = await getAdminReservationTables(eventId);
  if (!data) notFound();

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

      <JudgingMap
        tables={data.tables}
        selectedTableId={null}
        teamId={null}
        onSelect={() => {}}
        disabled
      />
    </section>
  );
}
