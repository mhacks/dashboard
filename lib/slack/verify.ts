import { isValidSlackRequest } from "@slack/bolt";

export function verifySlackRequest(headers: Headers, rawBody: string): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  const timestamp = headers.get("x-slack-request-timestamp");
  const signature = headers.get("x-slack-signature");
  if (!signingSecret || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  return isValidSlackRequest({
    signingSecret,
    body: rawBody,
    headers: {
      "x-slack-signature": signature,
      "x-slack-request-timestamp": ts,
    },
  });
}
