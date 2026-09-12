import { OpenRouter } from "@openrouter/sdk";
import { OpenRouterError } from "@openrouter/sdk/models/errors";

export const openRouterFreeModel = "openrouter/free";
export { OpenRouterError };

export async function createChatCompletion(input: {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OpenRouter is not configured. Add OPENROUTER_API_KEY to the server environment.",
    );
  }

  const openRouter = new OpenRouter({
    apiKey,
    serverURL: process.env.OPENROUTER_BASE_URL,
  });

  const completion = await openRouter.chat.send({
    chatRequest: {
      model: input.model,
      messages: input.messages,
      temperature: input.temperature ?? 0.4,
    },
  });

  if (completion instanceof ReadableStream) {
    throw new Error("OpenRouter returned a streaming response.");
  }

  const content = textFromContent(completion.choices[0]?.message.content);
  if (!content) {
    throw new Error("OpenRouter returned an empty draft.");
  }

  return {
    content,
    model: completion.model,
  };
}

function textFromContent(content: unknown) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) =>
      typeof part === "object" &&
      part !== null &&
      "text" in part &&
      typeof part.text === "string"
        ? part.text
        : "",
    )
    .join("")
    .trim();
}
