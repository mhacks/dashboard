import Link from "next/link";
import { redirect } from "next/navigation";
import { MHacksLogo } from "@/components/mhacks-logo";
import { ReservationBoard } from "@/components/reservation/reservation-board";
import {
  getParticipantEvents,
  getParticipantReservationUser,
  getTablesForEvent,
} from "@/lib/db/queries/reservation";
import { hasAcceptedReservationAccess } from "@/lib/reservation/access";

export const dynamic = "force-dynamic";

export default async function ReservePage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const user = await getParticipantReservationUser();
  if (user?.role === "organizer") {
    redirect("/admin/reservations");
  }
  if (!user) {
    redirect("/dashboard");
  }

  const [hasAccess, events, { event: eventParam }] = await Promise.all([
    hasAcceptedReservationAccess(user.id),
    getParticipantEvents(),
    searchParams,
  ]);
  if (!hasAccess) {
    redirect("/dashboard");
  }

  const selectedEvent =
    events.find((event) => event.id === eventParam) ?? events[0];

  const tables = selectedEvent ? await getTablesForEvent(selectedEvent.id) : [];

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-100 px-6 py-4 sm:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="opacity-80">
              <MHacksLogo size={28} />
            </span>
            <span className="text-sm font-semibold text-zinc-500">
              MHacks 2026
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-700"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 sm:px-10 sm:py-14">
        <div className="mb-8">
          <h1
            className="font-heading text-4xl italic leading-tight tracking-tight sm:text-5xl"
            style={{ color: "#3A4A26" }}
          >
            Reserve a Table
          </h1>
          <p className="mt-3 max-w-xl text-[14px] leading-7 text-zinc-500">
            Claim a spot in the judging area for your team. Select a table on
            the map, or let us assign one at random. Reservations are final.
          </p>
        </div>

        {!selectedEvent ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-16 text-center">
            <p className="font-heading text-2xl italic text-zinc-500">
              No events yet
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              There are no participant-visible reservation events right now.
            </p>
          </div>
        ) : (
          <ReservationBoard
            events={events}
            user={user}
            tables={tables}
            selectedEventId={selectedEvent.id}
          />
        )}
      </main>
    </div>
  );
}
