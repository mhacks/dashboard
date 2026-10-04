/*
  Temporary: decoy organizers for the find-my-organizer stage. Their codes
  generate and look like anyone else's, but redeeming one locks the hacker out
  of entering codes for DECOY_LOCKOUT_MINUTES instead of unlocking the puzzle.
  The code is still used up. Delete this file, and its use in
  lib/actions/hunt-codes.server.actions.ts, once the hunt is over.

  Emails, matched case-insensitively against the organizer's dashboard account.
*/
const DECOY_ORGANIZER_EMAILS: readonly string[] = [
  // "someone@umich.edu",
];

export const DECOY_LOCKOUT_MINUTES = 10;

const decoys = new Set(DECOY_ORGANIZER_EMAILS.map((e) => e.toLowerCase()));

export function isDecoyOrganizer(email: string) {
  return decoys.has(email.toLowerCase());
}
