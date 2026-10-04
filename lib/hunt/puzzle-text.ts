import { createHash } from "node:crypto";

/*
  The invisible-text puzzle: a wall of Latin, white on white, with one English
  passage carrying the riddle for the hacker's flower (lib/hunt/flowers.ts).
  Hackers who poke at the "blank" page eventually highlight it and read it.

  Everything is seeded from the hacker's user ID, so a reload shows the same
  wall with the sentence in the same place, while two hackers comparing
  screens find it in different spots, usually with different riddles.
*/

const PARAGRAPHS = 8;
/** Short paragraphs, so the wall reads as scattered fragments. */
const MIN_SENTENCES = 1;
const MAX_SENTENCES = 3;

const LATIN = (
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod " +
  "tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam " +
  "quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo " +
  "consequat duis aute irure in reprehenderit voluptate velit esse cillum " +
  "fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt " +
  "culpa qui officia deserunt mollit anim id est laborum curabitur pretium " +
  "tincidunt lacus nunc vitae facilisis vel augue mauris porta nibh semper " +
  "viverra nam libero justo laoreet felis ornare quam vestibulum praesent " +
  "sapien massa convallis pellentesque nec gravida arcu cursus turpis"
).split(" ");

/** Opens the hidden passage, so it reads as a message rather than filler. */
const LEAD_INS = [
  "Not so blank after all.",
  "You found the words nobody was meant to see.",
  "Sharp eyes.",
  "This page was never empty.",
];

/** mulberry32: small, fast, and plenty for shuffling filler. */
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

function latinSentence(random: () => number) {
  const length = 8 + Math.floor(random() * 10);
  const words = Array.from(
    { length },
    () => LATIN[Math.floor(random() * LATIN.length)],
  );
  // An occasional comma keeps the wall from looking machine-made.
  if (length > 11) words[4 + Math.floor(random() * 4)] += ",";
  const sentence = words.join(" ");
  return `${sentence[0].toUpperCase()}${sentence.slice(1)}.`;
}

/** The hidden wall for one hacker, as paragraphs of plain text. */
export function puzzleParagraphs(userId: string, riddle: string): string[] {
  const seed = createHash("sha256")
    .update(`mhacks-puzzle-text-v1:${userId}`)
    .digest()
    .readUInt32BE(0);
  const random = seededRandom(seed);

  const paragraphs = Array.from({ length: PARAGRAPHS }, () =>
    Array.from(
      {
        length:
          MIN_SENTENCES +
          Math.floor(random() * (MAX_SENTENCES - MIN_SENTENCES + 1)),
      },
      () => latinSentence(random),
    ),
  );

  // Never the very first sentence: someone who highlights only the top of the
  // page should still have to keep looking.
  const target = paragraphs[1 + Math.floor(random() * (PARAGRAPHS - 1))];
  const at = Math.floor(random() * (target.length + 1));
  const lead = LEAD_INS[Math.floor(random() * LEAD_INS.length)];
  const sentence = `${lead} ${riddle}`;
  target.splice(at, 0, sentence);

  return paragraphs.map((sentences) => sentences.join(" "));
}
