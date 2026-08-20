import { after } from "next/server";
import {
  hasSeenEvent,
  isEventCallback,
  isUrlVerification,
} from "@/lib/slack/events";
import { handleMention } from "@/lib/slack/handle-mention";
import { verifySlackRequest } from "@/lib/slack/verify";

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifySlackRequest(request.headers, rawBody)) {
    return new Response("unauthorized", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("bad request", { status: 400 });
  }

  if (isUrlVerification(payload)) {
    return Response.json({ challenge: payload.challenge });
  }

  const eventType =
    typeof payload === "object" &&
    payload !== null &&
    "event" in payload &&
    typeof payload.event === "object" &&
    payload.event !== null &&
    "type" in payload.event
      ? payload.event.type
      : undefined;
  console.info("slack event", {
    type:
      typeof payload === "object" && payload !== null && "type" in payload
        ? payload.type
        : undefined,
    eventType,
    retry: request.headers.get("x-slack-retry-num"),
  });

  if (request.headers.get("x-slack-retry-num")) {
    return new Response(null, { status: 200 });
  }

  if (isEventCallback(payload)) {
    if (hasSeenEvent(payload.event_id)) {
      return new Response(null, { status: 200 });
    }
    after(() => handleMention(payload));
  }

  return new Response(null, { status: 200 });
}
