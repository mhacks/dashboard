/*
  Every date the event runs on.

  These were previously spread across three modules that could disagree, and
  did: lib/landing/deadlines.ts held the application milestones as ISO strings
  with an explicit Eastern offset, lib/rsvp/deadline.ts held the enforced RSVP
  cutoff as a UTC instant, and lib/decisions.ts held the RSVP deadline a third
  time as hand-written display text ("August 28, 2026") with no relationship
  to either. The letter could — and did — promise a date the server rejected.

  Now there is one set of instants, and every display string is formatted from
  them (see lib/format/date.ts). A date shown to an applicant and a date
  enforced by the server can no longer drift apart, because they are the same
  value.

  See lib/config/event.ts for the naming rationale.
*/

import type { DecisionRound } from "@/lib/decisions";

export interface Deadline {
  id: string;
  /** Short human label, e.g. for a future timeline UI. */
  label: string;
  /** Phrase used by the countdown pill: "<countdownLabel> in 12d 04h…" */
  countdownLabel: string;
  /** ISO 8601 with timezone offset. */
  date: string;
}

/**
 * The application season, in order. Drives the landing hero countdown and the
 * #timeline section; `getNextDeadline` picks the first one still ahead.
 *
 * Times carry an explicit Eastern offset (-04:00 = EDT), i.e. deadlines land
 * at end of day in the event's own timezone.
 */
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

/**
 * When each round's admits must have RSVP'd by, as real instants — the
 * decision letter formats its date straight off these.
 */
export const RSVP_DEADLINES: Record<DecisionRound, string> = {
  early: "2026-08-21T23:59:59.999-04:00",
  regular: "2026-09-19T23:59:59.999-04:00",
};

/**
 * The cutoff the server actually enforces (see lib/rsvp/deadline.ts).
 *
 * KNOWN GAP: enforcement is global, but the deadlines above are per round, so
 * this is pinned to the early deadline — the earlier of the two — and a
 * regular-round admit would be refused after it despite their letter naming a
 * later date. That predates this module; collecting the dates here is what
 * makes it visible. Fixing it means making isRsvpOpen/assertRsvpOpen take the
 * applicant's decision round, which changes a write gate and belongs in its
 * own change rather than a config refactor.
 */
export const ENFORCED_RSVP_DEADLINE = RSVP_DEADLINES.early;

/** When the hackathon itself runs. */
export const EVENT_DATES = {
  start: "2026-10-03T00:00:00-04:00",
  end: "2026-10-04T23:59:59-04:00",
  /** Display form, since a range reads better written out than formatted. */
  label: "October 3–4, 2026",
} as const;

/** Where it runs, as shown on the decision letter. */
export const VENUE = {
  label: "University of Michigan — North Campus, Ann Arbor, MI",
  access: "Open 24 hours throughout the weekend",
  accommodations:
    "Overnight venue access is provided; formal hotel/sleeping accommodations are not offered.",
} as const;

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
