"use client";

import {
  AlertTriangleIcon,
  BatteryLowIcon,
  CircleCheckIcon,
  ClockIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  FRESH_WITHIN_MINUTES,
  FRESHNESS_LABEL,
  type Freshness,
  PUBLIC_WINDOW_MINUTES,
  ORGANIZER_WINDOW_HOURS,
  freshness,
  mapsUrl,
  personColors,
  seenAgo,
} from "@/lib/organizer-locations/display";
import type {
  MappedPerson,
  OrganizerMapSnapshot,
} from "@/lib/queries/organizer-locations";
import { cn } from "@/lib/utils";
import { OrganizerMap } from "./organizer-map";

/**
 * How often the page re-reads locations. The read goes through the server,
 * not straight to Supabase, so hackers never receive what the server strips.
 */
const REFRESH_MS = 2 * 60_000;
const CLOCK_TICK_MS = 15_000;
const LOW_BATTERY_PERCENT = 20;

const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

// The console states status in words; the icon makes it scannable without
// leaning on color.
const FRESHNESS_ICON: Record<Freshness, typeof CircleCheckIcon> = {
  fresh: CircleCheckIcon,
  recent: ClockIcon,
  stale: AlertTriangleIcon,
};

/**
 * The server's clock as seen from here. "Seen 4 min ago" counts from the
 * server's read time rather than the viewer's clock, which at a hackathon is
 * anyone's guess.
 */
function useServerNow(readAt: string) {
  const [elapsed, setElapsed] = useState({ readAt, ms: 0 });

  useEffect(() => {
    const receivedAt = Date.now();
    const id = window.setInterval(
      () => setElapsed({ readAt, ms: Date.now() - receivedAt }),
      CLOCK_TICK_MS,
    );
    return () => window.clearInterval(id);
  }, [readAt]);

  // A fresh snapshot restarts the count from its own read time.
  return Date.parse(readAt) + (elapsed.readAt === readAt ? elapsed.ms : 0);
}

/**
 * Re-renders the server page on an interval, and as soon as a hidden tab comes
 * back. Paused while the tab is hidden.
 */
function useAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
}

/**
 * `value` as of the last time `key` changed. A refresh hands over new arrays
 * even when nothing moved; this keeps the old ones so React and the map have
 * nothing to redo.
 */
function useStable<T>(value: T, key: string): T {
  const [stable, setStable] = useState({ key, value });
  if (stable.key !== key) {
    setStable({ key, value });
    return value;
  }
  return stable.value;
}

/** Everything the list shows. `recordedAt` changes when a phone reports in. */
const listKey = (people: MappedPerson[]) =>
  people
    .map((p) =>
      [
        p.id,
        p.name,
        p.latitude,
        p.longitude,
        p.accuracy,
        p.battery,
        p.recordedAt,
      ].join(","),
    )
    .join("|");

/**
 * Everything the map draws. A phone that reports from the same spot changes
 * only `recordedAt`, so the markers stay put.
 */
const mapKey = (people: MappedPerson[]) =>
  people
    .map((p) => [p.id, p.name, p.latitude, p.longitude, p.accuracy].join(","))
    .join("|");

export function PeopleView({
  snapshot,
  organizerView,
}: {
  snapshot: OrganizerMapSnapshot;
  organizerView: boolean;
}) {
  const { readAt } = snapshot;
  const people = useStable(snapshot.people, listKey(snapshot.people));
  const mapPeople = useStable(people, mapKey(people));
  const now = useServerNow(readAt);
  useAutoRefresh();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const colors = useMemo(
    () => personColors(mapPeople.map((person) => person.id)),
    [mapPeople],
  );

  const toggleSelected = useCallback((id: string) => {
    setSelectedId((current) => (current === id ? null : id));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <p
        className="font-red-hat-mono text-xs tracking-[0.04em] text-ui-ink-soft"
        aria-live="polite"
      >
        {people.length === 0
          ? "Nobody on the map"
          : `${people.length} on the map`}
        {" · "}checked {seenAgo(readAt, now)}, updates every 2 minutes
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <OrganizerMap
          people={mapPeople}
          colors={colors}
          selectedId={selectedId}
          onSelect={toggleSelected}
        />

        {people.length === 0 ? (
          <p className="border border-dashed border-ui-line-strong p-4 text-sm leading-[1.55] text-ui-ink-soft">
            {organizerView
              ? "No phone has reported in yet. Set up OwnTracks to appear here."
              : `No organizers have shared their location in the last ${PUBLIC_WINDOW_MINUTES} minutes. Ask anyone in an organizer shirt, or head to the front desk.`}
          </p>
        ) : (
          <ul
            className="flex flex-col gap-2 lg:max-h-[560px] lg:overflow-y-auto"
            aria-label="Organizers"
          >
            {people.map((person) => {
              const state = freshness(person.recordedAt, now);
              const StateIcon = FRESHNESS_ICON[state];
              const selected = person.id === selectedId;
              const lowBattery =
                person.battery !== null &&
                person.battery <= LOW_BATTERY_PERCENT;

              return (
                <li key={person.id}>
                  <div
                    className={cn(
                      "border bg-ui-paper p-3 transition-colors",
                      selected
                        ? "border-ui-ink"
                        : "border-ui-line hover:border-ui-line-strong",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSelected(person.id)}
                      aria-pressed={selected}
                      className="flex w-full items-start gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-ink"
                    >
                      <span
                        aria-hidden
                        className="mt-1.5 size-3 shrink-0 rounded-full ring-2 ring-ui-paper"
                        style={{ background: colors.get(person.id) }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-semibold text-ui-ink">
                            {person.name}
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 font-red-hat-mono text-[11px] tracking-[0.04em] text-ui-ink-soft">
                            <StateIcon className="size-3.5" aria-hidden />
                            {FRESHNESS_LABEL[state]}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-sm text-ui-ink">
                          Seen {seenAgo(person.recordedAt, now)}
                          <span className="text-ui-ink-soft">
                            {" "}
                            · {timeFormat.format(new Date(person.recordedAt))}
                          </span>
                        </span>
                        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ui-ink-soft">
                          {person.accuracy !== null ? (
                            <span>±{person.accuracy} m</span>
                          ) : null}
                          {organizerView && person.battery !== null ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1",
                                lowBattery && "font-semibold text-ui-ink",
                              )}
                            >
                              {lowBattery ? (
                                <BatteryLowIcon
                                  className="size-3.5"
                                  aria-hidden
                                />
                              ) : null}
                              Battery {person.battery}%
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                    <a
                      href={mapsUrl(person.latitude, person.longitude)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 ml-6 inline-flex items-center gap-1 text-xs font-medium text-ui-ink underline-offset-4 hover:underline"
                    >
                      Directions
                      <ExternalLinkIcon className="size-3" aria-hidden />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs leading-[1.55] text-ui-ink-soft">
        {`Live: updated in the last ${FRESH_WITHIN_MINUTES} minutes. `}
        Phones report when they move, so someone standing still can show an
        older time. Indoors, positions can be off by tens of meters and
        don&apos;t know which floor.
        {organizerView
          ? ` Organizers also see positions up to ${ORGANIZER_WINDOW_HOURS} hours old and battery levels; hackers see neither.`
          : null}
      </p>
    </div>
  );
}
