# Remote development

## The rule

**The shared remote is only ever touched from `main`, after merge.**

Schema changes reach the remote through **committed migration files** in
`supabase/migrations/`, applied with drizzle-kit. Merging lands the new
`schema.ts` and migration on `main`; it does **not** change the remote until
someone runs the steps below. Schema, auth config, and env vars promote
separately.

## One-time setup

Link the Supabase CLI to the remote project (for auth config push):

```bash
pnpm supabase login
pnpm supabase link --project-ref <ref>   # <ref> is in the project's dashboard URL
```

## 1. Schema → remote

```bash
git checkout main && git pull
DATABASE_URL="<remote-pooler-url>" pnpm drizzle-kit migrate
```

- Use the **Transaction pooler** string (port `6543`) from **Supabase Dashboard →
  Connect → ORMs** — that pooled mode is why
  [`lib/db/index.ts`](../lib/db/index.ts) sets `prepare: false`.
- The inline `DATABASE_URL` overrides `.env.local`, so the remote is only ever hit
  on purpose.
- The migration file should already be on `main` from the merged PR — this step
  only applies it.

## 2. Auth config → remote

[`supabase/config.toml`](../supabase/config.toml) is the source of truth for auth
rules, email templates, SMTP, `site_url`, redirect URLs, and whether the hosted
**Data API** (PostgREST) is enabled. `config push` syncs it to the remote project's
dashboard settings — don't edit those values in the Supabase dashboard directly.

The Data API is **disabled** (`[api] enabled = false`). The app does not use
`supabase.from(...)`; server routes and pages (including `/live`) use Drizzle over
`DATABASE_URL`. Auth, Realtime, and MCP OAuth still use the Supabase API URL.

Environment-specific values live in two committed layers of `config.toml`:

| Layer      | Block                  | What it holds                                 |
| ---------- | ---------------------- | --------------------------------------------- |
| Local      | base `[auth]`          | `127.0.0.1:3000`, SMTP off (Inbucket/Mailpit) |
| Production | `[remotes.production]` | Prod `site_url`, redirect URLs, SMTP settings |

On push, the CLI deep-merges `[remotes.production]` over the base config when
`project_id` matches the linked remote. SMTP credentials use `env(...)` and are read
from workspace root `.env` — copy values from
[Keys in Notion](https://app.notion.com/p/Keys-38124ca0c81b80ffac62f65acb442613).

```bash
pnpm supabase config push
```

Update prod URLs in `[remotes.production.auth]` when the production hostname changes.

## 3. App connection → remote

Values are in
[Keys in Notion](https://app.notion.com/p/Keys-38124ca0c81b80ffac62f65acb442613).

`NEXT_PUBLIC_*` values are GitHub Actions secrets. CD passes them into the image
as one `BUILD_ENV_B64` build arg
([`.github/workflows/cd.yml`](../.github/workflows/cd.yml)); the
[Dockerfile](../Dockerfile) writes that to `.env.production.local` before
`next build`. Next inlines them, so they are not set on the ECS task. Changing
one requires a new image build. Add a variable by listing it on the Prepare
build env step.

| Variable                               | Value                  |
| -------------------------------------- | ---------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | remote project URL     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | remote publishable key |
| `NEXT_PUBLIC_LOGIN_TURNSTILE_SITE_KEY` | Turnstile site key     |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`    | PostHog project token  |
| `NEXT_PUBLIC_POSTHOG_HOST`             | PostHog host           |

Server secrets stay in SSM and are injected by
[`task-definition.json`](../task-definition.json) when the task starts:

| Variable                    | Value                            |
| --------------------------- | -------------------------------- |
| `DATABASE_URL`              | remote Transaction pooler string |
| `RESUMES_BUCKET`            | AWS S3 bucket name               |
| `RESUMES_ACCESS_KEY_ID`     | AWS IAM access key               |
| `RESUMES_SECRET_ACCESS_KEY` | AWS IAM secret key               |

Set `RESUMES_REGION` to `us-east-2` in production (or omit it — that is the default).
Local resume storage is seeded by `supabase/seed.sql` only — there are no
`[storage.buckets.*]` blocks in `config.toml`, so `supabase seed buckets --linked`
cannot create buckets on the remote Supabase project. Remote schema promotion uses
drizzle-kit migrate, not `supabase db reset`, so `seed.sql` never runs against production.

## Command reference

| Command                                       | Does                                                         |
| --------------------------------------------- | ------------------------------------------------------------ |
| `DATABASE_URL="..." pnpm drizzle-kit migrate` | apply committed migrations to the **remote** db              |
| `pnpm supabase config push`                   | sync `config.toml` auth/email settings to the remote project |

There is no `db:*` wrapper for remote migrate yet — pass the pooler URL inline.
