/*
  Who this dashboard is running for.

  This app is meant to carry across MHacks iterations, so anything that names
  or dates the event belongs here rather than inline in a page. If you are
  setting up next year's dashboard, this file plus its siblings
  (contact.ts, links.ts, schedule.ts) should be the whole edit.

  Everything here is build-time constant on purpose. These values are read by
  server components, client components, and email templates alike, so they
  cannot be async, and they end up in the client bundle — which is fine, since
  none of it is secret. Real secrets stay in environment variables.
*/

const name = "MHacks";
const year = 2026;

export const EVENT = {
  /** The hackathon, without a year: "MHacks". */
  name,

  /** The calendar year this iteration runs in. */
  year,

  /**
   * The year's theme, used where the event is being presented rather than
   * merely identified — page titles, the landing hero. Set to null for an
   * iteration that isn't themed; callers must handle that.
   */
  edition: "Digital Garden" as string | null,

  /** "MHacks 2026" — the name to use in prose, subject lines, and titles. */
  fullName: `${name} ${year}`,

  /** How the event dates itself in copy: "Fall 2026". */
  season: `Fall ${year}`,

  city: "Ann Arbor",
  region: "Michigan",
  host: "the University of Michigan",

  /**
   * IANA zone. Every date the app renders is formatted in this zone (see
   * lib/format/date.ts) so a timestamp reads the same to every organizer
   * regardless of where they are.
   */
  timezone: "America/Detroit",
} as const;

/** "MHacks 2026 · Digital Garden", falling back to the plain name when the
 *  iteration has no theme. */
export function eventTitle(): string {
  return EVENT.edition
    ? `${EVENT.fullName} · ${EVENT.edition}`
    : EVENT.fullName;
}

/**
 * Filename-safe event slug for downloads: "mhacks-2026".
 */
export function eventSlug(): string {
  return `${EVENT.name.toLowerCase()}-${EVENT.year}`;
}
