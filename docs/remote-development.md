# Remote development

## The rule

**The shared remote is only ever touched from `main`, after merge.**

Schema changes reach the remote through **committed migration files** in
`supabase/migrations/`, applied with drizzle-kit. That keeps two people's
in-flight schema changes from clobbering each other on a shared database.

Merging lands the new `schema.ts` and migration on `main`; it does **not** change
the remote until someone runs the steps below. Schema, auth config, and env vars
promote separately.

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

Sanity check before shipping: on a clean local db, `pnpm db:migrate` should apply
every committed migration cleanly. See
[`supabase/migrations/BASELINE.md`](../supabase/migrations/BASELINE.md) if the
database already has the schema and needs a one-time baseline.

## 2. Auth config → remote

```bash
pnpm supabase config push
```

`supabase/config.toml` (auth rules + the magic-link email template) configures only
your local stack until pushed. **This is the most-forgotten step** — skip it and
remote logins redirect to the wrong place. For production also set, in the
dashboard, a real `site_url` / redirect URLs and an SMTP provider (Mailpit is
local-only, so the remote can't send email without it).

## 3. App connection → remote

Set these on your hosting platform, then redeploy:

| Variable                               | Value (Dashboard → Settings → API) |
| -------------------------------------- | ---------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | remote project URL                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | remote publishable key             |
| `DATABASE_URL`                         | remote Transaction pooler string   |

`NEXT_PUBLIC_*` vars are **inlined at build time**, not read at runtime — changing
them requires a rebuild/redeploy.

## Command reference

| Command                              | Does                                                     |
| ------------------------------------ | -------------------------------------------------------- |
| `DATABASE_URL="..." pnpm drizzle-kit migrate` | apply committed migrations to the **remote** db |
| `pnpm supabase config push`          | push auth rules + email templates to the remote project  |

There is no `db:*` wrapper for remote migrate yet — pass the pooler URL inline.

## Gotchas

1. **Schema and config promote separately** — `drizzle-kit migrate` for schema,
   `supabase config push` for auth. Forgetting the second is the most common
   mistake.
2. **Never run schema commands from a branch** — checkout `main` and pull first.
3. **`NEXT_PUBLIC_*` is build-time** — flipping local↔remote needs a rebuild.
4. **The remote needs real SMTP** — Mailpit only exists in the local Docker stack.
