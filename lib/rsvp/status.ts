export type RsvpStatus = "not_started" | "in_progress" | "submitted";

export function deriveRsvpStatus({
  hasFinal,
  hasDraft,
}: {
  hasFinal: boolean;
  hasDraft: boolean;
}): RsvpStatus {
  if (hasFinal) return "submitted";
  if (hasDraft) return "in_progress";
  return "not_started";
}
