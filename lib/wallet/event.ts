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
  venueName: "University of Michigan",
  venueAddress: "Ann Arbor, MI",
  venue: "University of Michigan, Ann Arbor, MI",
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
  // Central campus. Wallet also surfaces the pass near the event location.
  location: { latitude: 42.27792, longitude: -83.73401 },
  /** After this the pass greys out in Wallet and emailed links stop working. */
  endsAt: "2026-10-06T00:00:00-04:00",
  supportEmail: "hackathon-org@umich.edu",
  handbookUrl:
    "https://safe-banon-80d.notion.site/2026-Hacker-Handbook-3ca24ca0c81b80fb8adee2e26c8508af",
} as const;

export const WALLET_EVENT_END_MS = Date.parse(WALLET_EVENT.endsAt);

/** Attendee-facing copy shared by the Apple and Google Wallet passes. */
export const WALLET_PASS_COPY = {
  date: { label: "Date", value: "October 3-4th" },
  attendee: { label: "Name", fallback: "Hacker" },
  checkingIn: {
    label: "Checking in",
    value: `Initial check-in is at CCCB starting at 9:00 AM. Late check-in is in the ${WALLET_EVENT.lateCheckIn}. Bring a photo ID and show this QR code to event staff. Turn your brightness up if it won't scan.`,
  },
  venue: { label: "Venue", value: WALLET_EVENT.venue },
  handbook: {
    label: "Hacker handbook",
    value: WALLET_EVENT.handbookUrl,
  },
  website: { label: "Website", value: WALLET_EVENT.webOrigin },
  fallbackLabel: "Can't open this pass?",
  support: { label: "Questions", value: WALLET_EVENT.supportEmail },
} as const;

export function walletFallbackText(origin: string) {
  return `Your code is also at ${origin}/dashboard/qr`;
}
