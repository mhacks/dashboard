import { createHmac, hkdfSync } from "node:crypto";

/*
  A deliberate copy of puzzleKey() from the Discord bot's src/puzzle/keys.ts
  (github.com/mhacks/mhacks-discord-bot). The invisible-text puzzle hands each
  hacker this key, and the bot's /unlock recomputes it from their Discord ID,
  so the two must agree to the character. Both derive it from
  DISCORD_LINK_SECRET, which they already share for link tokens. The repos share no package;
  scripts/check-puzzle-key.mjs asserts this copy against keys the bot's code
  produced. Change one side and you must change the other.
*/

const KEY_INFO = "mhacks-puzzle-key-v1";

// Crockford base32: no I, L, O or U, so a key read off a screen can't be
// mistyped as a lookalike.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const KEY_CHARS = 10;

/** The key the bot expects from this Discord account, e.g. `7KQ2M-X9T4C`. */
export function puzzleKey(secret: string, discordId: string): string {
  const subkey = Buffer.from(hkdfSync("sha256", secret, "", KEY_INFO, 32));
  const mac = createHmac("sha256", subkey).update(discordId).digest();
  const chars = Array.from(
    mac.subarray(0, KEY_CHARS),
    (b) => ALPHABET[b & 31],
  ).join("");
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}
