import { drizzleRateLimiter, rateLimitMessage } from "@/lib/rate-limit/drizzle";
import type { RateLimiterAbstract } from "rate-limiter-flexible";

const DEFAULT_MESSAGE =
  "Too many requests in the last minute — wait a bit before trying again.";

const MCP_TOOLS = {
  whoami: { points: 30 },
  get_draft: { points: 30 },
  save_draft: {
    points: 20,
    message:
      "Too many draft saves in the last minute — wait a bit before checkpointing again.",
  },
  submit: {
    points: 5,
    message:
      "Too many submit attempts in the last minute — wait a bit before trying again.",
  },
  status: { points: 30 },
  resume_upload_url: {
    points: 10,
    message:
      "Too many upload URL requests in the last minute — wait a bit before trying again.",
  },
} as const satisfies Record<string, { points: number; message?: string }>;

export type McpRateLimitTool = keyof typeof MCP_TOOLS;

const MCP_RATE_LIMITERS = Object.fromEntries(
  (Object.keys(MCP_TOOLS) as McpRateLimitTool[]).map((tool) => [
    tool,
    drizzleRateLimiter(`mcp:${tool}`, MCP_TOOLS[tool].points),
  ]),
) as Record<McpRateLimitTool, RateLimiterAbstract>;

function blockedMessageForMcpTool(tool: McpRateLimitTool): string {
  const entry = MCP_TOOLS[tool];
  return "message" in entry && entry.message ? entry.message : DEFAULT_MESSAGE;
}

export async function mcpRateLimitMessage(
  tool: McpRateLimitTool,
  userId: string,
): Promise<string | null> {
  return rateLimitMessage(
    MCP_RATE_LIMITERS[tool],
    userId,
    blockedMessageForMcpTool(tool),
  );
}
