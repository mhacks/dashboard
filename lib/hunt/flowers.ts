import { createHash } from "node:crypto";

/*
  The flower challenge: each hacker is assigned one of the flowers on the
  MHacks main page (the SpeciesLabel garlands in components/landing). The
  invisible-text puzzle hides a riddle for their flower; clicking a petal of
  that flower on the main page is the next step.

  Assigning flowers per hacker means two hackers comparing notes usually have
  different riddles and different answers.

  DRAFT RIDDLES. They point at the flower without naming it and say "where you
  first arrived" rather than the main page.
*/

export const HUNT_FLOWERS = [
  {
    id: "apple-blossom",
    name: "Apple Blossom",
    riddle:
      "Before the fruit that fell on Newton, there was a pink and white bloom; find it where you first arrived, and pick a petal.",
  },
  {
    id: "black-eyed-susan",
    name: "Black-Eyed Susan",
    riddle:
      "She wears golden hair and one dark eye, and she keeps watch over Michigan summers; find her where you first arrived, and pick a petal.",
  },
  {
    id: "dwarf-lake-iris",
    name: "Dwarf Lake Iris",
    riddle:
      "Named for a rainbow and kept small by the lakeshore wind, it grows wild nowhere but around the Great Lakes; find it where you first arrived, and pick a petal.",
  },
  {
    id: "michigan-lily",
    name: "Michigan Lily",
    riddle:
      "Orange and freckled, it nods its head and borrows the name of the state it calls home; find it where you first arrived, and pick a petal.",
  },
  {
    id: "lily-of-the-valley",
    name: "Lily of the Valley",
    riddle:
      "Little white bells that never ring, sweet to smell and poison to taste; find them where you first arrived, and pick a petal.",
  },
] as const;

export type HuntFlower = (typeof HUNT_FLOWERS)[number];

/** The flower this hacker is looking for. Stable for as long as their account is. */
export function assignedFlower(userId: string): HuntFlower {
  const n = createHash("sha256")
    .update(`mhacks-hunt-flower-v1:${userId}`)
    .digest()
    .readUInt32BE(0);
  return HUNT_FLOWERS[n % HUNT_FLOWERS.length];
}
