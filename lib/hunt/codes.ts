import { randomInt } from "node:crypto";

import { HUNT_CODE_LENGTH } from "./constants";

/*
  Shared rules for puzzle hunt codes. The schema in lib/db/schema/hunt.ts
  explains why codes are stored as typed.
*/

/** How long a code works after the organizer generates it. */
export const HUNT_CODE_TTL_MINUTES = 5;
/** Wrong or right, each try counts; plenty for typos, useless for guessing. */
export const HUNT_REDEEM_ATTEMPTS = 10;
export const HUNT_REDEEM_WINDOW_SECONDS = 10 * 60;
/** Temporary: how long a decoy organizer's code hides the map from a hacker. */
export const DECOY_LOCKOUT_MINUTES = 10;

export function newHuntCode() {
  return randomInt(0, 10 ** HUNT_CODE_LENGTH)
    .toString()
    .padStart(HUNT_CODE_LENGTH, "0");
}

/** Crockford base32: no I, L, O or U, so a code copied by hand can't be misread. */
const PETAL_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** The final code a hacker gets for their flower, e.g. `7KQ2-X9T4`. */
export function newPetalCode() {
  const chars = Array.from(
    { length: 8 },
    () => PETAL_ALPHABET[randomInt(0, PETAL_ALPHABET.length)],
  ).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/**
 * A final code as typed into Discord, in the stored `XXXX-XXXX` form, or null
 * if it can't be one. Forgiving of case, spaces and a missing dash, and reads
 * the letters Crockford leaves out as the digits they look like.
 */
export function normalizePetalCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const chars = value
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (chars.length !== 8 || [...chars].some((c) => !PETAL_ALPHABET.includes(c)))
    return null;
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export function isHuntCodeShape(value: unknown): value is string {
  return (
    typeof value === "string" &&
    new RegExp(`^\\d{${HUNT_CODE_LENGTH}}$`).test(value)
  );
}
