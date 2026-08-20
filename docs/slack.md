# Slack bot

Organizers mention the bot in Slack; it queries dashboard Postgres via Drizzle.
Events are handled at [`app/api/slack/events/route.ts`](../app/api/slack/events/route.ts).

## Slack app

Create an app at [api.slack.com/apps](https://api.slack.com/apps).

1. **Event Subscriptions** — enable events, set Request URL to
   `https://<host>/api/slack/events`, and subscribe to the bot event `app_mention`.
2. **OAuth & Permissions** — add bot scopes `app_mentions:read`, `chat:write`,
   `users:read`, `users:read.email`, `channels:history`, and `groups:history`
   (private channels). After adding scopes, reinstall the app to the workspace.
3. Install the app to the workspace.
4. Copy the **Signing Secret** (Basic Information) and **Bot User OAuth Token**
   (OAuth & Permissions).

## Environment variables

Put these in root `.env` (shared secrets file; see
[Local development](./local-development.md)). Do not add them to
[`scripts/gen-env-local.sh`](../scripts/gen-env-local.sh) — that script overwrites
`.env.local`.

| Variable                    | Required | Purpose                                                |
| --------------------------- | -------- | ------------------------------------------------------ |
| `SLACK_SIGNING_SECRET`      | yes      | Verifies Slack request signatures                      |
| `SLACK_BOT_TOKEN`           | yes      | Bot User OAuth Token                                   |
| `SLACK_TEAM_ID`             | no       | Restrict to one workspace                              |
| `SLACK_ALLOWED_CHANNEL_IDS` | no       | Comma-separated channel IDs allowed to mention the bot |
| `OPENAI_API_KEY`            | yes      | LLM for answering questions                            |

## Local

Slack Event Subscriptions require a public HTTPS URL. Tunnel `localhost:3000` with
`cloudflared` or ngrok, then set the Request URL to
`https://<tunnel-host>/api/slack/events`.

Local `DATABASE_URL` comes from `.env.local` (Docker Supabase), so questions do not
hit production.

## Auth

The Slack user's email must match `public.users.email` with `role = organizer`. Keep
the bot in an organizers-only channel; replies can include applicant PII.

## Production

Add the same variables as SSM parameters (see
[`task-definition.json`](../task-definition.json)), then redeploy.

[Remote development](./remote-development.md)
