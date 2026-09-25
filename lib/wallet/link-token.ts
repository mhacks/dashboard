import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { getWalletConfig, isWalletConfigured } from "@/lib/wallet/config";
import { WALLET_EVENT_END_MS } from "@/lib/wallet/event";

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

function sign(payload: string) {
  return createHmac("sha256", getWalletConfig().linkSecret)
    .update(payload)
    .digest();
}

export function signWalletLinkToken(userId: string, expiresAtMs: number) {
  const payload = `${userId}.${expiresAtMs}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload).toString("base64url")}`;
}

/**
 * The emailed "Add to Apple Wallet" link, valid until the event ends. Null
 * when this environment can't sign passes, so emails simply omit the link.
 */
export function buildWalletPassUrl(origin: string, userId: string) {
  if (!isWalletConfigured()) return null;
  const token = signWalletLinkToken(userId, WALLET_EVENT_END_MS);
  return `${origin}/wallet/pass?t=${token}`;
}

/** Returns the user id for a valid, unexpired token, otherwise null. */
export function verifyWalletLinkToken(token: string): string | null {
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
