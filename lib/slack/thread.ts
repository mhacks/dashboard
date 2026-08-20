import type { ModelMessage } from "ai";
import { getSlackClient } from "./client";
import { stripBotMention } from "./format";

const THREAD_LIMIT = 20;
const MAX_MSG_CHARS = 1500;

export async function getThreadHistory(options: {
  channel: string;
  threadTs: string;
  currentTs: string;
}): Promise<ModelMessage[]> {
  const slack = getSlackClient();
  const result = await slack.conversations.replies({
    channel: options.channel,
    ts: options.threadTs,
    limit: THREAD_LIMIT,
    inclusive: true,
  });

  const history: ModelMessage[] = [];
  for (const message of result.messages ?? []) {
    if (message.ts === options.currentTs) continue;
    const text = stripBotMention(message.text ?? "").slice(0, MAX_MSG_CHARS);
    if (!text) continue;
    history.push({
      role: message.bot_id ? "assistant" : "user",
      content: text,
    });
  }
  return history;
}
