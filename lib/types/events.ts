import { z } from "zod";

/**
 * The shape of an event's URL segment. Shared by the create/update actions and
 * by the route params that read it back, so a slug that can be written is
 * always a slug that can be routed to.
 */
export const eventSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and single hyphens.",
  );

export const MAX_EVENT_NAME_LENGTH = 120;

/**
 * Turns an event name into a candidate slug. Callers must still resolve
 * collisions — this is deliberately pure so it can run on the client to preview
 * the URL while someone types the name.
 *
 * Returns "" for input with nothing slug-worthy in it (all punctuation, or
 * non-Latin script), which the caller treats as "ask them to type one".
 */
export function slugifyEventName(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      // Strip combining marks so "Café" becomes "cafe" rather than "caf".
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64)
      // A trailing hyphen can reappear after the slice.
      .replace(/-+$/g, "")
  );
}
