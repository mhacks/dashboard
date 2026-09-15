/**
 * Everything on the Wallet pass that is about the event rather than the
 * attendee. Passes are static — Wallet never re-fetches them — so a change here
 * only reaches people who download their pass again.
 *
 * Kept apart from lib/wallet/pass.ts so email code can compute link expiry
 * without importing the pass signer.
 */
export const WALLET_EVENT = {
  name: "MHacks 2026",
  dates: "October 3–4, 2026",
  venue: "University of Michigan — North Campus, Ann Arbor, MI",
  // Wallet suggests the pass on the lock screen inside these windows. Each
  // interval may span at most 24 hours, hence one per day.
  relevantIntervals: [
    {
      startDate: "2026-10-03T07:00:00-04:00",
      endDate: "2026-10-04T07:00:00-04:00",
    },
    {
      startDate: "2026-10-04T07:00:00-04:00",
      endDate: "2026-10-05T00:00:00-04:00",
    },
  ],
  // North Campus. Wallet also surfaces the pass near this point.
  location: { latitude: 42.2912, longitude: -83.7157 },
  /** After this the pass greys out in Wallet and emailed links stop working. */
  endsAt: "2026-10-06T00:00:00-04:00",
  supportEmail: "hackathon@mhacks.org",
} as const;

export const WALLET_EVENT_END_MS = Date.parse(WALLET_EVENT.endsAt);
