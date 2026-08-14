export const RSVP_DEADLINE_ISO = "2026-08-15T03:59:59.999Z";
export const RSVP_DEADLINE_MS = Date.parse(RSVP_DEADLINE_ISO);

export function isRsvpOpen(nowMs = Date.now()): boolean {
  return nowMs <= RSVP_DEADLINE_MS;
}

export function assertRsvpOpen(nowMs = Date.now()): void {
  if (!isRsvpOpen(nowMs)) {
    throw new Error("RSVPs are closed");
  }
}
