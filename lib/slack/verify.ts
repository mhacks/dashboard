import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_SKEW_SECONDS = 60 * 5;

export function verifySlackRequest(headers: Headers, rawBody: string): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  const timestamp = headers.get("x-slack-request-timestamp");
  const signature = headers.get("x-slack-signature");
  if (!signingSecret || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > MAX_SKEW_SECONDS) {
    return false;
  }

  const digest = createHmac("sha256", signingSecret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest("hex");
  const computed = Buffer.from(`v0=${digest}`, "utf8");
  const incoming = Buffer.from(signature, "utf8");
  if (computed.length !== incoming.length) return false;
  return timingSafeEqual(computed, incoming);
}
