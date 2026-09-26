import type { DecisionRound } from "@/lib/decisions";

/**
 * The enforced RSVP cutoff for each admissions round.
 *
 * Early admissions were temporarily extended through August 23. Keeping the
 * cutoffs round-specific lets regular admits RSVP without reopening the form
 * for early admits who never confirmed their spot.
 *
 * Regular was extended by one hour past midnight on the night of September 19
 * to let stragglers finish; the advertised date in RSVP_DEADLINE stays
 * September 19, so this is a grace period rather than a new deadline.
 */
export const RSVP_DEADLINE_ISO: Record<DecisionRound, string> = {
  early: "2026-08-24T03:59:59.999Z",
  regular: "2026-09-20T04:59:59.999Z",
};

export const RSVP_DEADLINE_MS: Record<DecisionRound, number> = {
  early: Date.parse(RSVP_DEADLINE_ISO.early),
  regular: Date.parse(RSVP_DEADLINE_ISO.regular),
};
