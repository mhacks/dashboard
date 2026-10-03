import { createHmac } from "node:crypto";

/**
 * The hidden-text puzzle's per-participant phrase.
 *
 * Derived, not stored: HMAC(secret, userId) picks one word from each list, so
 * the same hacker always sees the same phrase and the next challenge can check
 * an answer by recomputing it for the signed-in user. Without the secret, the
 * public word lists don't let anyone predict someone else's phrase.
 */

const ADJECTIVES = [
  "amber",
  "ancient",
  "bashful",
  "bitter",
  "bold",
  "brave",
  "bright",
  "calm",
  "clever",
  "copper",
  "crimson",
  "curious",
  "dusty",
  "eager",
  "faded",
  "fierce",
  "gentle",
  "golden",
  "hidden",
  "hollow",
  "humble",
  "idle",
  "jade",
  "lonely",
  "lucky",
  "mellow",
  "misty",
  "noble",
  "quiet",
  "rusty",
  "silver",
  "velvet",
] as const;

const NOUNS = [
  "badger",
  "beetle",
  "bramble",
  "candle",
  "comet",
  "cricket",
  "falcon",
  "fern",
  "fox",
  "heron",
  "lantern",
  "lily",
  "magpie",
  "maple",
  "meadow",
  "moth",
  "otter",
  "owl",
  "pebble",
  "poppy",
  "raven",
  "robin",
  "sparrow",
  "teapot",
  "thistle",
  "tulip",
  "violin",
  "walrus",
  "willow",
  "wren",
  "yarrow",
  "zephyr",
] as const;

const VERBS = [
  "bakes",
  "builds",
  "chases",
  "dances",
  "dreams",
  "drifts",
  "giggles",
  "glows",
  "hides",
  "hums",
  "juggles",
  "knits",
  "laughs",
  "leaps",
  "naps",
  "paints",
  "ponders",
  "races",
  "reads",
  "rests",
  "sings",
  "sleeps",
  "sneezes",
  "spins",
  "sulks",
  "swims",
  "tiptoes",
  "travels",
  "waits",
  "waltzes",
  "whistles",
  "wanders",
] as const;

const PLACES = [
  "at dawn",
  "at dusk",
  "at midnight",
  "beneath the bridge",
  "beside the pond",
  "by the fountain",
  "in the attic",
  "in the cellar",
  "in the garden",
  "in the greenhouse",
  "in the library",
  "in the orchard",
  "in the rain",
  "in the snow",
  "near the lighthouse",
  "on the balcony",
  "on the rooftop",
  "under the oak",
  "under the stars",
  "through the fog",
  "past the gate",
  "behind the shed",
  "atop the hill",
  "along the river",
  "across the field",
  "inside the clock",
  "within the hedge",
  "beyond the wall",
  "before breakfast",
  "after supper",
  "on a tuesday",
  "in the moonlight",
] as const;

// 32^4 ≈ 1M phrases. Collisions between two hackers are possible but harmless:
// answers are checked against the signed-in user's own phrase, never looked up.

// Public-domain Cicero (De finibus 1.32–33), the source of "lorem ipsum".
const LATIN = `Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur. Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur. At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident. Similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Curabitur pretium tincidunt lacus, nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida. Duis ac tellus et risus vulputate vehicula. Donec lobortis risus a elit. Etiam tempor, ut ullamcorper, ligula eu tempor congue, eros est euismod turpis, id tincidunt sapien risus a quam. Maecenas fermentum consequat mi. Donec fermentum, pellentesque malesuada nulla a mi. Duis sapien sem, aliquet nec, commodo eget, consequat quis, neque. Aliquam faucibus, elit ut dictum aliquet, felis nisl adipiscing sapien, sed malesuada diam lacus eget erat. Cras mollis scelerisque nunc. Nullam arcu. Aliquam consequat. Curabitur augue lorem, dapibus quis, laoreet et, pretium ac, nisi. Aenean magna nisl, mollis quis, molestie eu, feugiat in, orci. In hac habitasse platea dictumst.`;

const LATIN_SENTENCES = LATIN.match(/[^.]+\./g)!.map((s) => s.trim());

// Dev-only fallback so the page works locally without setup. Production must
// set a real secret, or every phrase would be derivable from this repo.
const DEV_SECRET = "scavenger-hunt-dev-secret";

function getSecret(): string {
  const secret = process.env.SCAVENGER_HUNT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SCAVENGER_HUNT_SECRET is not set");
  }
  return DEV_SECRET;
}

function digestFor(userId: string): Buffer {
  return createHmac("sha256", getSecret())
    .update(`hidden-text-v1:${userId}`)
    .digest();
}

export function hiddenPhraseFor(userId: string): string {
  const d = digestFor(userId);
  return [
    "the",
    ADJECTIVES[d[0] % ADJECTIVES.length],
    NOUNS[d[1] % NOUNS.length],
    VERBS[d[2] % VERBS.length],
    PLACES[d[3] % PLACES.length],
  ].join(" ");
}

/** Checks a submitted answer against the user's own phrase. */
export function isHiddenPhraseFor(userId: string, answer: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  return normalize(answer) === normalize(hiddenPhraseFor(userId));
}

/**
 * The wall of Latin with the user's phrase dropped in as one sentence, at a
 * position that also varies per user so nobody can point a friend at "the
 * fifth line".
 */
export function hiddenTextFor(userId: string): {
  before: string;
  phrase: string;
  after: string;
} {
  const d = digestFor(userId);
  // Keep it off the first and last sentence, where it's easiest to stumble on.
  const at = 1 + (d.readUInt16BE(4) % (LATIN_SENTENCES.length - 2));
  const phrase = hiddenPhraseFor(userId);
  return {
    before: LATIN_SENTENCES.slice(0, at).join(" "),
    phrase: `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}.`,
    after: LATIN_SENTENCES.slice(at).join(" "),
  };
}
