import { ENFORCED_RSVP_DEADLINE } from "@/lib/config/schedule";

/*
  The RSVP write gate.

  The instant itself lives in lib/config/schedule.ts next to the per-round
  deadlines the decision letters quote, so the date an applicant is shown and
  the date the server enforces come from the same place. See the note on
  ENFORCED_RSVP_DEADLINE: enforcement is still global while the quoted
  deadlines are per round.
*/

export const RSVP_DEADLINE_ISO = ENFORCED_RSVP_DEADLINE;
export const RSVP_DEADLINE_MS = Date.parse(RSVP_DEADLINE_ISO);

export function isRsvpOpen(nowMs = Date.now()): boolean {
  return nowMs <= RSVP_DEADLINE_MS;
}

export function assertRsvpOpen(nowMs = Date.now()): void {
  if (!isRsvpOpen(nowMs)) {
    throw new Error("RSVPs are closed");
  }
}
