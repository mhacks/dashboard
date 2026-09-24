import { getEventRoster } from "@/lib/queries/events";
import { serializeCsv, type CsvColumn } from "@/lib/rsvp/csv";
import type { EventRosterEntry } from "@/lib/queries/events";
import { eventSlugSchema } from "@/lib/types/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS: readonly CsvColumn<EventRosterEntry>[] = [
  { header: "Name", value: (row) => row.name },
  { header: "Email", value: (row) => row.email },
  { header: "University", value: (row) => row.university },
  { header: "Checked in at", value: (row) => row.checkedInAt },
  { header: "Method", value: (row) => row.method },
  { header: "Checked in by", value: (row) => row.checkedInByName },
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventSlug: string }> },
): Promise<Response> {
  try {
    const { eventSlug } = await params;

    const parsed = eventSlugSchema.safeParse(eventSlug);
    if (!parsed.success) return new Response("Not found", { status: 404 });

    // Carries its own requireOrganizer(); a throw becomes the 403 below.
    const roster = await getEventRoster(parsed.data);
    if (!roster) return new Response("Not found", { status: 404 });

    const csv = serializeCsv(COLUMNS, roster.entries);
    const date = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="mhacks-2026-${parsed.data}-checkins-${date}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Forbidden", {
      status: 403,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
