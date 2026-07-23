# PostHog MCP Analytics — Integration Report

## What was done

The MHacks dashboard MCP server (`app/mcp/route.ts`) has been instrumented with PostHog MCP analytics using the `@posthog/mcp` SDK (Path B — `mcp-handler` on Next.js).

Every tool call, agent intent, and failure handled by the server will now emit `$mcp_*` events in PostHog, keyed to the authenticated user's ID.

## Files modified or created

| File | Change |
|------|--------|
| `app/mcp/route.ts` | Added `instrument()` call inside the `createMcpHandler` callback; added module-scope `PostHog` client; wrapped exports to flush after each invocation |
| `package.json` | Added `@posthog/mcp 0.9.1` (pinned — pre-1.0 beta) |
| `.env.local` | Added `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` |

## Changes in detail

### `app/mcp/route.ts`

- Imported `instrument` from `@posthog/mcp` and `PostHog` from `posthog-node`.
- Created a module-scope PostHog client with `flushAt: 1` and `flushInterval: 0` (required for serverless — events are sent synchronously per invocation):
  ```ts
  const posthog = process.env.POSTHOG_PROJECT_TOKEN
    ? new PostHog(process.env.POSTHOG_PROJECT_TOKEN, { host: ..., flushAt: 1, flushInterval: 0 })
    : null;
  ```
- Called `instrument(server, posthog, { identify })` as the first line of the `createMcpHandler` setup callback. The `identify` function maps each request to the authenticated Supabase user ID (from `extra.authInfo.extra.userId`) so calls from the same user group together across stateless requests.
- Replaced the `GET`/`POST` exports with a `withPostHogFlush` wrapper that calls `await posthog.flush()` in a `finally` block after every invocation, ensuring no events are dropped before the serverless function freezes.

## Events you'll see in PostHog

Once the server handles its next request:

- `$mcp_initialize` — per client handshake
- `$mcp_tool_call` — per tool invocation (with tool name, duration, success/error)
- `$mcp_tools_list` — per `tools/list` response
- `$mcp_prompt_get` / `$mcp_prompts_list` — for the `apply_interview` prompt
- `$exception` — whenever a tool throws or returns `isError: true`

All events carry `distinct_id` set to the Supabase user ID, so you can see per-user tool usage.

## Next steps

1. **Deploy** — the env vars are set in `.env.local` for local development. For production (ECS Fargate), add `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` to the task definition's environment config.
2. **Dashboard** — visit [https://posthog.com/docs/mcp-analytics](https://posthog.com/docs/mcp-analytics) for the pre-built MCP analytics dashboard and event reference.
3. **SDK is pre-1.0** — `@posthog/mcp 0.9.1` is pinned exactly. Check the [changelog](https://github.com/PostHog/posthog-mcp) before upgrading minor versions.
