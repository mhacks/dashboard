// Asserts lib/discord/link-token.ts still opens the token the Discord bot's
// src/lib/link-token.ts produces. The two files are copies of each other in
// separate repositories, so nothing but this check stops them drifting apart.
//
// The vector below is the same one asserted in the bot's
// test/link-token.test.ts. If the token format changes, regenerate it there and
// paste it here in the same commit.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const VECTOR = {
  secret: "0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0",
  token:
    "v1.g436S3Pqc8yndCmioBr7ftEDmHTjF9Ae59sr4qh-u8ci0vFgnKwfAjgGm2TGAmLod0gwvTocofG1Z6jUA9u8j2nW6O68haQ2-kh0C9lMM0BK_hNI_kI3",
  payload: { d: "123456789012345678", u: "hacker_one", ts: 1790000000 },
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The codec is TypeScript, so run it through Node's type stripping.
const script = `
import { open, seal } from ${JSON.stringify(resolve(root, "lib/discord/link-token.ts"))};
const V = ${JSON.stringify(VECTOR)};
const opened = open(V.secret, V.token, V.payload.ts);
if (!opened.ok) {
  console.error("FAIL: the shared vector no longer opens:", opened.reason);
  process.exit(1);
}
if (JSON.stringify(opened.payload) !== JSON.stringify(V.payload)) {
  console.error("FAIL: payload mismatch", opened.payload, "!=", V.payload);
  process.exit(1);
}
// And that what we seal, we can open — catches a half-applied format change.
const mine = seal(V.secret, V.payload);
const back = open(V.secret, mine, V.payload.ts);
if (!back.ok || back.payload.d !== V.payload.d) {
  console.error("FAIL: seal/open does not round-trip");
  process.exit(1);
}
console.log("discord link token: in sync with the bot");
`;

try {
  execFileSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      "--input-type=module",
      "--eval",
      script,
    ],
    {
      stdio: "inherit",
      cwd: root,
    },
  );
} catch {
  process.exit(1);
}
