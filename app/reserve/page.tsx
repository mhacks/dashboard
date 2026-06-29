import Image from "next/image";
import Link from "next/link";
import {
  getEvents,
  getSignedInUser,
  getTablesForEvent,
  getTeams,
} from "@/lib/db/queries/reservation";
import { ReservationBoard } from "@/components/reservation/reservation-board";

export const dynamic = "force-dynamic";

export default async function ReservePage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const [events, user, teams, { event: eventParam }] = await Promise.all([
    getEvents(),
    getSignedInUser(),
    getTeams(),
    searchParams,
  ]);

  const selectedEvent =
    events.find((e) => e.id === eventParam) ?? events[0] ?? null;

  const tables = selectedEvent ? await getTablesForEvent(selectedEvent.id) : [];

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-100 px-6 py-4 sm:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/mhacks_logo.png"
              alt="MHacks"
              width={28}
              height={28}
              className="opacity-80"
            />
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

        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-16 text-center">
            <p className="font-heading text-2xl italic text-zinc-500">
              No events yet
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Seed some events with{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[12px]">
                pnpm db:seed
              </code>{" "}
              to start reserving tables.
            </p>
          </div>
        ) : (
          <ReservationBoard
            events={events}
            user={user}
            teams={teams}
            tables={tables}
            selectedEventId={selectedEvent!.id}
          />
        )}
      </main>
    </div>
  );
}
