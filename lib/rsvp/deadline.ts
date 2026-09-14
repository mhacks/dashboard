import type { DecisionRound } from "@/lib/decisions";

/**
 * The enforced RSVP cutoff for each admissions round.
 *
 * Early admissions were temporarily extended through August 23. Keeping the
 * cutoffs round-specific lets regular admits RSVP without reopening the form
 * for early admits who never confirmed their spot.
 */
export const RSVP_DEADLINE_ISO: Record<DecisionRound, string> = {
  early: "2026-08-24T03:59:59.999Z",
  regular: "2026-09-20T03:59:59.999Z",
};

export const RSVP_DEADLINE_MS: Record<DecisionRound, number> = {
  early: Date.parse(RSVP_DEADLINE_ISO.early),
  regular: Date.parse(RSVP_DEADLINE_ISO.regular),
};
