import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { getRequestOrigin } from "@/lib/url/request-origin";
import { isAppleWalletConfigured } from "@/lib/wallet/config";
import { WALLET_EVENT, WALLET_EVENT_END_MS } from "@/lib/wallet/event";
import { isGoogleWalletConfigured } from "@/lib/wallet/google-config";

/**
 * Signed download links for emailed Wallet passes, so a hacker can add the
 * pass from their inbox without signing in first.
 *
 * Token: base64url("<userId>.<expiresAtMs>") + "." + base64url(HMAC-SHA256).
 *
 * What a leaked link grants is a pass carrying the user's id — the same value
 * a screenshot of their dashboard QR already exposes — so the token only needs
 * to be unforgeable and eventually expire, not single-use.
 */

const linkSecretSchema = z.string().min(32);

function getLinkSecret() {
  const parsed = linkSecretSchema.safeParse(process.env.WALLET_LINK_SECRET);
  if (!parsed.success) {
    throw new Error("WALLET_LINK_SECRET must be at least 32 characters.");
  }
  return parsed.data;
}

function isLinkSigningConfigured() {
  return linkSecretSchema.safeParse(process.env.WALLET_LINK_SECRET).success;
}

function sign(payload: string) {
  return createHmac("sha256", getLinkSecret()).update(payload).digest();
}

export function signWalletLinkToken(userId: string, expiresAtMs: number) {
  const payload = `${userId}.${expiresAtMs}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload).toString("base64url")}`;
}

/**
 * Emailed pass links are valid until the event ends. A missing platform config
 * or link secret returns null so the email renderer simply omits that link.
 */
export function buildAppleWalletPassUrl(origin: string, userId: string) {
  if (!isAppleWalletConfigured() || !isLinkSigningConfigured()) return null;
  const token = signWalletLinkToken(userId, WALLET_EVENT_END_MS);
  return `${origin}/wallet/pass?t=${token}`;
}

export function buildGoogleWalletPassUrl(origin: string, userId: string) {
  if (!isGoogleWalletConfigured() || !isLinkSigningConfigured()) return null;
  const token = signWalletLinkToken(userId, WALLET_EVENT_END_MS);
  return `${origin}/wallet/google?t=${token}`;
}

/**
 * The {{wallet_pass_url}} and {{google_wallet_pass_url}} merge values for one
 * email recipient, signed at send time from the audience CSV's wallet_user_id
 * column (set only for RSVPed hackers). Keeping the long links out of the CSV
 * keeps recipient lists small, and keeps their fingerprint independent of the
 * host and config they were resolved under.
 *
 * Without a user id nothing is added: the fields stay unset, so the renderer
 * drops their links, unless the recipient list supplies its own values.
 */
export async function walletPassMergeData(
  userId: string | undefined,
): Promise<Record<string, string>> {
  if (!userId) return {};

  // Production links always use the public host: behind the load balancer the
  // request host can be an internal AWS address. Elsewhere, link back to the
  // host that signed them, falling back when a send runs outside a request.
  const origin =
    process.env.NODE_ENV === "production"
      ? WALLET_EVENT.webOrigin
      : await getRequestOrigin().catch(() => WALLET_EVENT.webOrigin);
  return {
    wallet_pass_url: buildAppleWalletPassUrl(origin, userId) ?? "",
    google_wallet_pass_url: buildGoogleWalletPassUrl(origin, userId) ?? "",
  };
}

/** Returns the user id for a valid, unexpired token, otherwise null. */
export function verifyWalletLinkToken(token: string): string | null {
  if (!isLinkSigningConfigured()) return null;

  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra !== undefined) return null;

  const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  const expected = sign(payload);
  const actual = Buffer.from(encodedSignature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  const [userId, expiresAt] = payload.split(".");
  if (!userId || !z.uuid().safeParse(userId).success) return null;

  const expiresAtMs = Number(expiresAt);
  if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) return null;

  return userId;
}
