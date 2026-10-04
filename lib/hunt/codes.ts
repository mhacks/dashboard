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

export function newHuntCode() {
  return randomInt(0, 10 ** HUNT_CODE_LENGTH)
    .toString()
    .padStart(HUNT_CODE_LENGTH, "0");
}

export function isHuntCodeShape(value: unknown): value is string {
  return (
    typeof value === "string" &&
    new RegExp(`^\\d{${HUNT_CODE_LENGTH}}$`).test(value)
  );
}
