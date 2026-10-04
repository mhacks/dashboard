// Asserts lib/hunt/puzzle-key.ts still produces the keys the Discord bot's
// src/puzzle/keys.ts produces. The two are copies in separate repositories, so
// nothing but this check stops them drifting apart: a drifted key would be
// rejected by /unlock, and every hacker would be stuck at the bot.
//
// The keys below came from the bot's own puzzleKey(). If its key format
// changes, regenerate them there and paste them here in the same commit.
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VECTOR = {
  secret: "0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0",
  keys: {
    "123456789012345678": "13Q5W-A2T5X",
    "987654321098765432": "SQAMX-KC2BW",
  },
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The key code is TypeScript, so run it through Node's type stripping.
const script = `
import { puzzleKey } from ${JSON.stringify(resolve(root, "lib/hunt/puzzle-key.ts"))};
const V = ${JSON.stringify(VECTOR)};
let failed = false;
for (const [discordId, expected] of Object.entries(V.keys)) {
  const actual = puzzleKey(V.secret, discordId);
  if (actual !== expected) {
    console.error("FAIL:", discordId, "expected", expected, "got", actual);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log("puzzle key: matches the Discord bot");
`;

execFileSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--no-warnings",
    "--input-type=module",
    "-e",
    script,
  ],
  { stdio: "inherit" },
);
