import type { AppMentionEvent } from "@slack/types";

const MAX_SEEN_EVENTS = 500;
const seenEventIds = new Set<string>();

export function hasSeenEvent(eventId: string): boolean {
  if (seenEventIds.has(eventId)) return true;
  seenEventIds.add(eventId);
  if (seenEventIds.size > MAX_SEEN_EVENTS) {
    const oldest = seenEventIds.values().next().value;
    if (oldest) seenEventIds.delete(oldest);
  }
  return false;
}

export type { AppMentionEvent };

export type SlackEventCallback = {
  type: "event_callback";
  team_id: string;
  event_id: string;
  event: AppMentionEvent | { type: string };
};

export type SlackUrlVerification = {
  type: "url_verification";
  challenge: string;
};

export function isUrlVerification(
  payload: unknown,
): payload is SlackUrlVerification {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "type" in payload &&
    payload.type === "url_verification" &&
    "challenge" in payload &&
    typeof payload.challenge === "string"
  );
}

export function isEventCallback(
  payload: unknown,
): payload is SlackEventCallback {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "type" in payload &&
    payload.type === "event_callback" &&
    "event_id" in payload &&
    typeof payload.event_id === "string" &&
    "team_id" in payload &&
    typeof payload.team_id === "string" &&
    "event" in payload &&
    typeof payload.event === "object" &&
    payload.event !== null &&
    "type" in payload.event &&
    typeof payload.event.type === "string"
  );
}

export function isAppMention(
  event: SlackEventCallback["event"],
): event is AppMentionEvent {
  return event.type === "app_mention";
}
