import type { ConversationsRepliesResponse } from "@slack/web-api";
import type { ModelMessage } from "ai";
import { getOrganizerForSlackUser } from "./authorize";
import { getSlackClient } from "./client";
import { stripBotMention } from "./format";

type SlackMessage = NonNullable<
  ConversationsRepliesResponse["messages"]
>[number];

const THREAD_LIMIT = 20;
const THREAD_PAGE_SIZE = 200;
const THREAD_MAX_PAGES = 10;
const MAX_MSG_CHARS = 1500;

export async function getThreadHistory(options: {
  channel: string;
  threadTs: string;
  currentTs: string;
}): Promise<ModelMessage[]> {
  const slack = getSlackClient();
  const messages: SlackMessage[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < THREAD_MAX_PAGES; page++) {
    const result = await slack.conversations.replies({
      channel: options.channel,
      ts: options.threadTs,
      limit: THREAD_PAGE_SIZE,
      inclusive: true,
      ...(cursor ? { cursor } : {}),
    });
    messages.push(...(result.messages ?? []));
    cursor = result.response_metadata?.next_cursor || undefined;
    if (!cursor) break;
  }

  const recent = messages.slice(-THREAD_LIMIT);
  const organizerCache = new Map<string, boolean>();

  async function isOrganizer(userId: string): Promise<boolean> {
    const cached = organizerCache.get(userId);
    if (cached !== undefined) return cached;
    try {
      const organizer = await getOrganizerForSlackUser(userId);
      const allowed = organizer !== null;
      organizerCache.set(userId, allowed);
      return allowed;
    } catch (error) {
      console.error("slack thread organizer lookup failed", error);
      organizerCache.set(userId, false);
      return false;
    }
  }

  const history: ModelMessage[] = [];
  for (const message of recent) {
    if (message.ts === options.currentTs) continue;
    const text = stripBotMention(message.text ?? "").slice(0, MAX_MSG_CHARS);
    if (!text) continue;

    if (message.bot_id) {
      history.push({ role: "assistant", content: text });
      continue;
    }

    if (!message.user) continue;
    if (!(await isOrganizer(message.user))) continue;
    history.push({ role: "user", content: text });
  }
  return history;
}
