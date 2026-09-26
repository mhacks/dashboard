/**
 * How every scan outcome is spoken and coloured. Shared by the server action
 * and the scanner UI so the wording can't drift between what is recorded and
 * what a volunteer reads off the screen.
 */

export type CheckInOutcome =
  | "checked-in"
  | "already-checked-in"
  | "unknown-code"
  | "not-accepted"
  | "no-rsvp"
  | "event-closed"
  | "server-error";

/**
 * Three states, because a volunteer reads colour before words.
 *   go   — let them in
 *   warn — they are already in; probably a double scan, possibly a queue-jump
 *   stop — do not let them in without a human sorting it out
 */
export type ScanSeverity = "go" | "warn" | "stop";

export const OUTCOME_SEVERITY: Record<CheckInOutcome, ScanSeverity> = {
  "checked-in": "go",
  "already-checked-in": "warn",
  "unknown-code": "stop",
  "not-accepted": "stop",
  "no-rsvp": "stop",
  "event-closed": "stop",
  "server-error": "stop",
};

/** Read at arm's length across a noisy room, so: short, and never a sentence. */
export const OUTCOME_HEADLINE: Record<CheckInOutcome, string> = {
  "checked-in": "Checked in",
  "already-checked-in": "Already checked in",
  "unknown-code": "Code not recognised",
  "not-accepted": "Not accepted",
  "no-rsvp": "No RSVP on file",
  "event-closed": "Event closed",
  "server-error": "Something went wrong",
};

/** What the volunteer should actually do, when it isn't obvious from the headline. */
export const OUTCOME_GUIDANCE: Record<CheckInOutcome, string | null> = {
  "checked-in": null,
  "already-checked-in": null,
  "unknown-code":
    "That isn't an MHacks code. Ask them to open their dashboard.",
  "not-accepted":
    "They don't have a spot at MHacks. Send them to an organizer.",
  "no-rsvp": "They never confirmed their spot. Send them to an organizer.",
  "event-closed":
    "This event isn't open for check-in. Check you're on the right scanner.",
  "server-error":
    "Nothing was recorded. Try again, or wave them through and tell a lead.",
};

/**
 * Whether a scan put a new person into the event.
 *
 * The single source of truth for the scanner's running total, which must mean
 * "people checked into this event" and nothing else. Everything else a scanner
 * does — an unrecognised code, a duplicate, someone without an RSVP — is a
 * scan that happened, not an attendee who arrived, and none of them may move
 * this number.
 *
 * A duplicate is excluded for the same reason from the other side: that person
 * was already counted when they were first scanned in. So is a repeat scan at
 * an event that allows several — it let them in again, but they were counted
 * on their first.
 */
export function countsAsCheckIn(result: {
  outcome: CheckInOutcome;
  scanNumber?: number;
}): boolean {
  return result.outcome === "checked-in" && result.scanNumber === 1;
}

/**
 * Whether a scan let someone in at all — first visit or a repeat. Drives the
 * scanner's scan total, which only events allowing repeats show.
 */
export function countsAsScan(result: { outcome: CheckInOutcome }): boolean {
  return result.outcome === "checked-in";
}

/**
 * "Scan 2 of 3" for events that allow repeats, null for the usual one-scan
 * event where the count would only be noise.
 */
export function describeScanCount(
  used: number | undefined,
  allowed: number | undefined,
): string | null {
  if (!used || !allowed || allowed <= 1) return null;
  return `Scan ${used} of ${allowed}`;
}

/** Tailwind-free literals: this palette is read by a camera-lit screen, not themed. */
export const SEVERITY_STYLE: Record<
  ScanSeverity,
  { background: string; glyph: string }
> = {
  go: { background: "#12823f", glyph: "[ OK ]" },
  warn: { background: "#b45309", glyph: "[ !! ]" },
  stop: { background: "#b3261e", glyph: "[ XX ]" },
};
