import type { ModelMessage } from "ai";
import {
  getOrganizerForSlackUser,
  isAllowedChannel,
  isAllowedTeam,
} from "./authorize";
import { answerQuestion } from "./ask";
import { getSlackClient } from "./client";
import { isAppMention, type SlackEventCallback } from "./events";
import { stripBotMention } from "./format";
import { getThreadHistory } from "./thread";

export async function handleMention(
  payload: SlackEventCallback,
): Promise<void> {
  try {
    await handleMentionUnsafe(payload);
  } catch (error) {
    console.error("slack mention handler failed", error);
  }
}

async function handleMentionUnsafe(payload: SlackEventCallback): Promise<void> {
  if (!isAllowedTeam(payload.team_id)) return;

  const { event } = payload;
  if (!isAppMention(event)) return;
  if (event.bot_id || event.subtype) return;
  if (!isAllowedChannel(event.channel)) return;

  const slack = getSlackClient();
  const organizer = await getOrganizerForSlackUser(event.user);
  if (!organizer) {
    await slack.chat.postEphemeral({
      channel: event.channel,
      user: event.user,
      text: "Only dashboard organizers can query the database. Your Slack email must match an organizer account.",
    });
    return;
  }

  const question = stripBotMention(event.text);
  const thread_ts = event.thread_ts ?? event.ts;
  if (!question) {
    await slack.chat.postMessage({
      channel: event.channel,
      thread_ts,
      text: "Mention me with a question, e.g. how many applications are pending?",
    });
    return;
  }

  let history: ModelMessage[] = [];
  if (event.thread_ts) {
    try {
      history = await getThreadHistory({
        channel: event.channel,
        threadTs: event.thread_ts,
        currentTs: event.ts,
      });
    } catch (error) {
      console.error("slack thread history failed", error);
    }
  }

  try {
    const text = await answerQuestion(question, history);
    await slack.chat.postMessage({
      channel: event.channel,
      thread_ts,
      text: text.slice(0, 3900),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await slack.chat.postMessage({
      channel: event.channel,
      thread_ts,
      text: `Could not answer that: ${message}`,
    });
  }
}
