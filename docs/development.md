# Development workflow

How a change travels from your laptop to the shared remote. For how Supabase is
wired into the app (the local stack, the auth clients), see
[docs/supabase.md](./supabase.md).

## The core rule

**Every branch develops against its own local database. The shared remote is only
ever touched from `main`, after merge.**

Locally you iterate with `db:push` — no migration files, instantly disposable, no
merge conflicts. The remote only ever changes through **committed migration files**,
applied from `main`. That's what stops two people's in-flight schema changes from
clobbering each other on a shared database.

## 1. Start the local stack

```bash
pnpm db:local          # boot the Supabase stack in Docker (needs Docker running)
pnpm db:env            # write .env from `supabase status`
pnpm db:push           # apply the current schema to the fresh local db
pnpm dev               # run the app against localhost
```

`db:env` runs [`scripts/gen-env.ts`](../scripts/gen-env.ts): it reads
`supabase status` and writes `.env` (git-ignored). Re-run it whenever the stack's
values change. For what the stack contains and the service URLs, see
[docs/supabase.md](./supabase.md#the-local-stack).

> Editing `supabase/config.toml`? It's only read at boot — restart with
> `pnpm db:local:stop` then `pnpm db:local`.

## 2. Develop: change the schema

The schema lives in [`lib/db/schema.ts`](../lib/db/schema.ts) — Drizzle owns every
table and column.

```bash
# edit lib/db/schema.ts
pnpm db:push           # push straight to your LOCAL db — instant, no migration file
```

Two conventions keep merges painless:

- **Keep changes additive** (new tables, nullable columns) until merged.
- **Never generate migration files on a branch.** Commit only `lib/db/schema.ts`,
  nothing in `drizzle/`. Migrations are generated on `main` (step 4).

## 3. Merge to `main`

```bash
git add lib/db/schema.ts        # the schema change only — nothing in drizzle/
git commit -m "Add <thing> to schema"
git push -u origin <your-branch>   # then open a PR against main
```

CI runs Prettier, ESLint, and a production build — it never touches a database.
Merging lands the new `schema.ts` on `main`; it does **not** create a migration or
change the remote.

## 4. Ship to the remote

Do this **from `main`, after merge** — never from a branch. The three concerns
promote separately (see the [three-concerns model](./supabase.md#three-concerns)).

One-time, link the CLI to the remote project:

```bash
pnpm supabase login
pnpm supabase link --project-ref <ref>   # <ref> is in the project's dashboard URL
```

### Schema → remote

```bash
git checkout main && git pull
pnpm db:generate                  # merged schema delta → drizzle/NNNN_*.sql
git add drizzle/ && git commit -m "Generate migration" && git push
DATABASE_URL="<remote-pooler-url>" pnpm db:migrate
```

- Use the **Transaction pooler** string (port `6543`) from **Supabase Dashboard →
  Connect → ORMs** — that pooled mode is why
  [`lib/db/index.ts`](../lib/db/index.ts) sets `prepare: false`.
- The inline `DATABASE_URL` overrides `.env`, so the remote is only ever hit on
  purpose.
- **Generate only on `main`.** Migrations are one totally-ordered sequence; two
  branches generating before merge would claim the same number and scramble the
  order. Generating after each merge makes the sequence follow merge order.

Sanity check before shipping: `pnpm db:local:reset` re-runs every migration on a
clean local db. If that succeeds, the files will apply cleanly to the remote.

### Auth config → remote

```bash
pnpm supabase config push
```

`supabase/config.toml` (auth rules + the magic-link email template) configures only
your local stack until pushed. **This is the most-forgotten step** — skip it and
remote logins redirect to the wrong place. For production also set, in the
dashboard, a real `site_url` / redirect URLs and an SMTP provider (Mailpit is
local-only, so the remote can't send email without it).

### App connection → remote

Set these on your hosting platform, then redeploy:

| Variable                               | Value (Dashboard → Settings → API) |
| -------------------------------------- | ---------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | remote project URL                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | remote publishable key             |
| `DATABASE_URL`                         | remote Transaction pooler string   |

`NEXT_PUBLIC_*` vars are **inlined at build time**, not read at runtime — changing
them requires a rebuild/redeploy.

## Command reference

| Command               | Does                                                       |
| --------------------- | ---------------------------------------------------------- |
| `pnpm db:local`       | start the local stack                                      |
| `pnpm db:local:stop`  | stop it                                                    |
| `pnpm db:local:reset` | **wipe** the local db and re-apply all migrations          |
| `pnpm db:env`         | (re)generate `.env` from the running stack                 |
| `pnpm db:push`        | apply `schema.ts` to the **local** db (no migration)       |
| `pnpm db:generate`    | write a migration from the schema delta (**on `main`**)    |
| `pnpm db:migrate`     | apply migrations to the **remote** (inline `DATABASE_URL`) |

## Gotchas

1. **Schema and config promote separately** — `db:migrate` for schema,
   `supabase config push` for auth. Forgetting the second is the most common
   mistake.
2. **`db:push` is local-only; `db:migrate` is remote-only.** Never cross them.
3. **Generate migrations on `main`, never on a branch** — keeps the sequence
   totally ordered by merge order.
4. **`NEXT_PUBLIC_*` is build-time** — flipping local↔remote needs a rebuild.
5. **Mailpit is local-only** — the remote needs real SMTP to send magic-link email.
