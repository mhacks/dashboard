/*
  Date formatting, in the event's locale and timezone.

  These replace ~14 hand-rolled Intl.DateTimeFormat / toLocaleDateString calls
  that had each drifted apart: some passed "en-US" and some passed undefined,
  some pinned a timezone and most didn't, and a few fell back to the bare
  toLocaleDateString() default ("8/17/2026") in a UI that says "Aug 17, 2026"
  everywhere else.

  Both the locale and the timezone are pinned rather than left to the runtime.
  An undefined locale resolves to the *server's* locale during SSR and the
  *browser's* on hydration, so any timestamp rendered on both sides was a
  hydration mismatch waiting to happen — and an unpinned timezone meant the
  same moment read differently to an organizer in Ann Arbor and one in
  California. Event-local time is the shared reference everyone on the team
  actually means.

  Each export corresponds to a shape already in use somewhere in the app; they
  are named for the shape rather than the caller so a new caller can pick one
  by looking at the sample output.
*/

import { EVENT } from "@/lib/config/event";

const EVENT_TIME_ZONE = EVENT.timezone;
const EVENT_LOCALE = "en-US";

export type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

function formatter(options: Intl.DateTimeFormatOptions) {
  // Intl.DateTimeFormat construction is the expensive part, so each shape is
  // built once and reused rather than per render.
  const instance = new Intl.DateTimeFormat(EVENT_LOCALE, {
    ...options,
    timeZone: EVENT_TIME_ZONE,
  });
  return (value: DateInput) => instance.format(toDate(value));
}

/** "September 12, 2026" — deadlines and decision letters. */
export const formatEventDate = formatter({
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** "Aug 17, 2026" */
export const formatMediumDate = formatter({
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** "Aug 17" — dense lists where the year is obvious from context. */
export const formatShortDate = formatter({
  month: "short",
  day: "numeric",
});

/** "7:15 PM" */
export const formatTimeOfDay = formatter({
  hour: "numeric",
  minute: "2-digit",
});

/** "Aug 17, 7:15 PM" */
export const formatShortDateTime = formatter({
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "Aug 17, 2026, 7:15 PM" — submission and review receipts. */
export const formatMediumDateTime = formatter({
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * "Monday, August 17, 2026 at 7:15 PM EDT" — spelled out, with the zone
 * named, for email where the reader has no page context and may be anywhere.
 */
export const formatLongDateTimeWithZone = formatter({
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});
