const defaultBaseUrl = "https://openrouter.ai/api/v1";

export const openRouterFreeModel = "openrouter/free";

export class OpenRouterError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export async function createChatCompletion(input: {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseUrl = process.env.OPENROUTER_BASE_URL ?? defaultBaseUrl;

  if (!apiKey) {
    throw new OpenRouterError(
      "OpenRouter is not configured. Add OPENROUTER_API_KEY to the server environment.",
    );
  }

  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        temperature: input.temperature ?? 0.4,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new OpenRouterError(
      formatOpenRouterFailure(response.status, body),
      response.status,
    );
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload)) {
    throw new OpenRouterError("OpenRouter returned an invalid response.");
  }

  const choices = payload.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new OpenRouterError("OpenRouter returned no completion choices.");
  }

  const message = choices[0];
  if (!isRecord(message) || !isRecord(message.message)) {
    throw new OpenRouterError("OpenRouter returned an invalid completion.");
  }

  const content = message.message.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new OpenRouterError("OpenRouter returned an empty draft.");
  }

  return {
    content: content.trim(),
    model: typeof payload.model === "string" ? payload.model : input.model,
  };
}

function formatOpenRouterFailure(status: number, body: string) {
  const trimmed = body.trim();

  if (!trimmed) {
    return `OpenRouter request failed (${status}).`;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isRecord(parsed) && typeof parsed.error === "object" && parsed.error) {
      const error = parsed.error;
      if (isRecord(error) && typeof error.message === "string") {
        return error.message;
      }
    }
  } catch {
    // fall through to raw body
  }

  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}…` : trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
