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
rules, email templates, SMTP, `site_url`, and redirect URLs. `config push` syncs it
to the remote project's dashboard settings — don't edit those values in the Supabase
dashboard directly.

Environment-specific values live in two committed layers of `config.toml`:

| Layer | Block | What it holds |
| ----- | ----- | ------------- |
| Local | base `[auth]` | `127.0.0.1:3000`, SMTP off (Inbucket/Mailpit) |
| Production | `[remotes.production]` | Prod `site_url`, redirect URLs, SMTP settings |

On push, the CLI deep-merges `[remotes.production]` over the base config when
`project_id` matches the linked remote. SMTP credentials use `env(...)` and are read
from workspace root `.env`.

```bash
pnpm supabase config push
```

Update prod URLs in `[remotes.production.auth]` when the production hostname changes.

## 3. App connection → remote

Set these on your hosting platform, then redeploy:

| Variable                               | Value (Dashboard → Settings → API) |
| -------------------------------------- | ---------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | remote project URL                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | remote publishable key             |
| `DATABASE_URL`                         | remote Transaction pooler string   |

`NEXT_PUBLIC_*` vars are **inlined at build time** — changing them requires a
rebuild/redeploy.

## Command reference

| Command                                       | Does                                                    |
| --------------------------------------------- | ------------------------------------------------------- |
| `DATABASE_URL="..." pnpm drizzle-kit migrate` | apply committed migrations to the **remote** db         |
| `pnpm supabase config push`                   | sync `config.toml` auth/email settings to the remote project |

There is no `db:*` wrapper for remote migrate yet — pass the pooler URL inline.
