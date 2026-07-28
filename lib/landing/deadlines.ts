/**
 * Application timeline — single source of truth for the hero countdown.
 *
 * ENGINEERING HANDOFF NOTES
 * - To drive this from a backend, replace the DEADLINES constant with fetched
 *   data (same shape) — everything downstream (`getNextDeadline`,
 *   `DeadlineCountdown`) only depends on this array.
 * - Dates are ISO 8601 with an explicit Eastern offset (-04:00 = EDT), i.e.
 *   deadlines land at end-of-day Ann Arbor time. Adjust if the real deadline
 *   time differs.
 * - `countdownLabel` is the phrasing shown in the hero pill while this
 *   deadline is the next one upcoming.
 */

export interface Deadline {
  id: string;
  /** Short human label, e.g. for a future timeline UI. */
  label: string;
  /** Phrase used by the countdown pill: "<countdownLabel> in 12d 04h…" */
  countdownLabel: string;
  /** ISO 8601 with timezone offset. */
  date: string;
}

export const DEADLINES: Deadline[] = [
  {
    id: "apps-open",
    label: "Applications open",
    countdownLabel: "Applications open",
    date: "2026-06-22T00:00:00-04:00",
  },
  {
    id: "early-apps-due",
    label: "Early applications due",
    countdownLabel: "Early applications close",
    date: "2026-08-07T23:59:59-04:00",
  },
  {
    id: "early-decisions",
    label: "Early decisions released",
    countdownLabel: "Early decisions out",
    date: "2026-08-14T23:59:59-04:00",
  },
  {
    id: "regular-apps-due",
    label: "Regular applications due",
    countdownLabel: "Applications close",
    date: "2026-09-12T23:59:59-04:00",
  },
  {
    id: "regular-decisions",
    label: "Regular decisions released",
    countdownLabel: "Decisions out",
    date: "2026-09-19T23:59:59-04:00",
  },
];

/** Next deadline still in the future, or null once the season is over. */
export function getNextDeadline(now: Date = new Date()): Deadline | null {
  return (
    DEADLINES.find((d) => new Date(d.date).getTime() > now.getTime()) ?? null
  );
}

export interface TimeParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Non-negative breakdown of the time from `now` until `target`. */
export function getTimeParts(target: Date, now: Date): TimeParts {
  const total = Math.max(0, target.getTime() - now.getTime());
  return {
    days: Math.floor(total / 86_400_000),
    hours: Math.floor(total / 3_600_000) % 24,
    minutes: Math.floor(total / 60_000) % 60,
    seconds: Math.floor(total / 1_000) % 60,
  };
}
