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
  datesShort: "Oct 3–4, 2026",
  doorsOpenAt: "2026-10-03T09:00:00-04:00",
  doorsOpenTime: "9:00 AM",
  doorsOpenDay: "Oct 3",
  venueName: "Central Campus Classroom Building (CCCB)",
  venueAddress: "1225 Geddes Ave, Ann Arbor, MI 48109",
  venue:
    "Central Campus Classroom Building (CCCB), 1225 Geddes Ave, Ann Arbor, MI 48109",
  lateCheckIn:
    "Pierpont corridor, 2101 Bonisteel Blvd, from 11:00 AM to 2:30 PM",
  /** Canonical public host used for artwork and links stored at Google. */
  webOrigin: "https://mhacks.org",
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
  // CCCB. Wallet also surfaces the pass near the initial check-in location.
  location: { latitude: 42.27792, longitude: -83.73401 },
  /** After this the pass greys out in Wallet and emailed links stop working. */
  endsAt: "2026-10-06T00:00:00-04:00",
  supportEmail: "hackathon-org@umich.edu",
  handbookUrl:
    "https://safe-banon-80d.notion.site/2026-Hacker-Handbook-3ca24ca0c81b80fb8adee2e26c8508af",
} as const;

export const WALLET_EVENT_END_MS = Date.parse(WALLET_EVENT.endsAt);
