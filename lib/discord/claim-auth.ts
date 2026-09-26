import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

/**
 * Authenticates the Discord bot's calls to /discord_auth/claim.
 *
 * The bot has no Supabase credential and no session — the dashboard's Data API
 * is disabled — so it proves itself with an HMAC over the request, keyed by a
 * subkey of the DISCORD_LINK_SECRET both services read from SSM. Mirrors
 * signClaim in the bot's src/lib/dashboard.ts.
 */

/** Domain-separated so the link-token key can share the same secret. */
const CLAIM_KEY_INFO = "mhacks-discord-claim-auth-v1";

/**
 * How far out of step the bot's clock may be. Bounds how long a captured
 * request stays replayable; the claim is idempotent, so this only needs to be
 * tight enough to matter, not tight enough to be exact.
 */
export const CLAIM_SKEW_SECONDS = 300;

export function claimKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "", CLAIM_KEY_INFO, 32));
}

export function signClaim(
  secret: string,
  timestamp: string,
  body: string,
): string {
  return createHmac("sha256", claimKey(secret))
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

/**
 * Never throws: everything here is attacker-controlled, so a bad signature is
 * an expected answer. Returns false rather than saying which check failed.
 */
export function verifyClaimSignature(args: {
  secret: string;
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  nowSeconds?: number;
}): boolean {
  const { secret, rawBody, timestamp, signature } = args;
  if (!secret || !timestamp || !signature) return false;

  // Shape-check before the compare so timingSafeEqual can't throw on length.
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;

  const sent = Number(timestamp);
  if (!Number.isFinite(sent)) return false;
  const now = args.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - sent) > CLAIM_SKEW_SECONDS) return false;

  try {
    return timingSafeEqual(
      Buffer.from(signClaim(secret, timestamp, rawBody), "hex"),
      Buffer.from(signature.toLowerCase(), "hex"),
    );
  } catch {
    return false;
  }
}
