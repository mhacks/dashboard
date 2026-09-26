import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

/**
 * The token in the /discord_auth?t=... link the Discord bot hands a member.
 *
 * Sealed by the bot's src/lib/link-token.ts and opened here. This file is a
 * deliberate copy of that one — the two live in separate repositories, so there
 * is no shared package to put it in. Both sides implement seal and open so both
 * can exercise the same vector; the bot's test/link-token.test.ts holds the
 * canonical one, and scripts/check-discord-token.mjs in this repo asserts this
 * copy still opens it. Change one side and you must change the other.
 *
 * AES-256-GCM rather than a signed-but-readable payload: the tag authenticates
 * the whole token, so a tampered Discord ID fails to open rather than being
 * trusted, and the ID does not sit in a URL that ends up in browser history and
 * server logs.
 */

/** Domain-separated so the claim-request HMAC key can share the same secret. */
const TOKEN_KEY_INFO = "mhacks-discord-link-token-v1";

const PREFIX = "v1.";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Long enough to sign in from scratch — the dashboard emails a login code, and
 * that round trip can easily eat five minutes — and short enough that a link
 * pasted somewhere public goes stale quickly.
 */
export const LINK_TOKEN_TTL_SECONDS = 900;

export interface LinkTokenPayload {
  /** Discord user ID. */
  d: string;
  /** Discord username, shown on the confirm screen. */
  u: string;
  /** Issued-at, seconds since the epoch. */
  ts: number;
}

export type OpenResult =
  | { ok: true; payload: LinkTokenPayload }
  | { ok: false; reason: "malformed" | "expired" };

export function linkTokenKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "", TOKEN_KEY_INFO, 32));
}

export function seal(secret: string, payload: LinkTokenPayload): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", linkTokenKey(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return (
    PREFIX +
    Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString("base64url")
  );
}

/**
 * Never throws: every input here came from a URL someone else controls, so a
 * malformed token is an expected answer rather than an exception.
 */
export function open(
  secret: string,
  token: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): OpenResult {
  if (!token.startsWith(PREFIX)) return { ok: false, reason: "malformed" };

  try {
    const raw = Buffer.from(token.slice(PREFIX.length), "base64url");
    if (raw.length <= IV_BYTES + TAG_BYTES) {
      return { ok: false, reason: "malformed" };
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      linkTokenKey(secret),
      raw.subarray(0, IV_BYTES),
    );
    decipher.setAuthTag(raw.subarray(raw.length - TAG_BYTES));
    const plaintext = Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES, raw.length - TAG_BYTES)),
      decipher.final(),
    ]).toString("utf8");

    const payload = JSON.parse(plaintext) as LinkTokenPayload;
    if (
      typeof payload?.d !== "string" ||
      !payload.d ||
      typeof payload.u !== "string" ||
      typeof payload.ts !== "number" ||
      !Number.isFinite(payload.ts)
    ) {
      return { ok: false, reason: "malformed" };
    }

    // Rejects a clock-skewed future token too, not just a stale one.
    if (Math.abs(nowSeconds - payload.ts) > LINK_TOKEN_TTL_SECONDS) {
      return { ok: false, reason: "expired" };
    }

    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}

/** The URL the Verify button points at. */
export function linkUrl(
  baseUrl: string,
  secret: string,
  discordId: string,
  username: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const token = seal(secret, { d: discordId, u: username, ts: nowSeconds });
  return `${baseUrl.replace(/\/+$/, "")}/discord_auth?t=${encodeURIComponent(token)}`;
}
