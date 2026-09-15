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

| Variable                    | Required   | Purpose                                                                                                    |
| --------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| `SLACK_SIGNING_SECRET`      | yes        | Verifies Slack request signatures                                                                          |
| `SLACK_BOT_TOKEN`           | yes        | Bot User OAuth Token                                                                                       |
| `SLACK_TEAM_ID`             | no         | Restrict to one workspace                                                                                  |
| `SLACK_ALLOWED_CHANNEL_IDS` | production | Comma-separated channel IDs allowed to mention the bot. Unset fails closed in production and open locally. |
| `OPENAI_API_KEY`            | local      | LLM for answering questions (used when OpenRouter is unset)                                                |
| `OPENROUTER_API_KEY`        | production | OpenRouter key from Terraform (`openrouter.tf`); injected via SSM                                          |
| `OPENROUTER_BASE_URL`       | production | OpenRouter OpenAI-compatible base URL from Terraform                                                       |

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

Production secrets are Terraform-managed in
[`mhacks/deployment`](https://github.com/mhacks/deployment) (`live/secrets.tf`,
`live/slack.tf`, `live/openrouter.tf`). Set `slack_*` in local `*.tfvars` (gitignored)
and apply that stack — do not create SSM parameters in the AWS console.
`SLACK_ALLOWED_CHANNEL_IDS` is required in production; the bot will not
answer in any channel until it is set.

The bot uses `DATABASE_URL`. Prefer a dedicated Postgres role with `SELECT`
only on the tables listed in [`lib/slack/schema-prompt.ts`](../lib/slack/schema-prompt.ts).

[Remote development](./remote-development.md)
