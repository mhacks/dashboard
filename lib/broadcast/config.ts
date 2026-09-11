export const BROADCAST_BODY_LIMIT = 160;
export const BROADCAST_SUBJECT_LIMIT = 200;

export function broadcastErrorMessage(
  error: unknown,
  fallback = "Something went wrong.",
) {
  return error instanceof Error ? error.message : fallback;
}
