# Local development

## The rule

**Every branch develops against its own local database.**

Iterate with `db:push` (drizzle-kit push) for fast feedback, then generate a
migration file on your branch before opening a PR. The remote is never touched
during local development.

## 1. Start the local stack

`pnpm db:start` (= `supabase start` + env generation) boots a full Supabase stack in
Docker:

| Service  | URL               | Purpose                                   |
| -------- | ----------------- | ----------------------------------------- |
| Postgres | `127.0.0.1:54322` | the database (`DATABASE_URL` points here) |
| API/Auth | `127.0.0.1:54321` | what the auth clients talk to             |
| Studio   | `127.0.0.1:54323` | Supabase Studio — DB GUI                  |
| Mailpit  | `127.0.0.1:54324` | catches outgoing email locally            |

```bash
pnpm db:start       # boot Supabase in Docker + write .env.local
pnpm db:push        # apply the current schema to the fresh local db
pnpm dev            # run the app against localhost
```

Supabase Studio is already running once the stack is up — open it to inspect data.
Everything here is configured by [`supabase/config.toml`](../supabase/config.toml),
which is read only at boot (restart after editing it).

`db:start` runs `supabase start` then
[`scripts/gen-env-local.sh`](../scripts/gen-env-local.sh), which reads
`supabase status` and writes `.env.local` (git-ignored). Re-run `pnpm db:env`
whenever the stack's values change.

> Editing `supabase/config.toml`? It's only read at boot — restart with
> `pnpm db:stop` then `pnpm db:start`.

## 2. Change the schema

The schema lives in [`lib/db/schema.ts`](../lib/db/schema.ts) — Drizzle owns every
table and column.

```bash
# edit lib/db/schema.ts
pnpm db:push        # drizzle-kit push → your LOCAL db — iterate quickly
pnpm db:generate    # write the migration file for this change
```

Two conventions keep merges painless:

- **Keep changes additive** (new tables, nullable columns) until merged.
- **Generate the migration file on your branch** and commit it alongside
  `lib/db/schema.ts` before opening a PR.

## 3. Open a PR

```bash
git add lib/db/schema.ts supabase/migrations/
git commit -m "Add <thing> to schema"
git push -u origin <your-branch>   # then open a PR against main
```

CI runs Prettier, ESLint, and a production build — it never touches a database.

## Command reference

| Command            | Does                                                           |
| ------------------ | -------------------------------------------------------------- |
| `pnpm db:start`    | start the local Supabase stack + write `.env.local`            |
| `pnpm db:stop`     | stop the stack                                                 |
| `pnpm db:reset`    | wipe the local Postgres volume (Supabase CLI)                  |
| `pnpm db:env`      | (re)generate `.env.local` from the running stack               |
| `pnpm db:push`     | drizzle-kit push — apply `schema.ts` to the **local** db       |
| `pnpm db:generate` | drizzle-kit generate — write a migration from the schema delta |
| `pnpm db:migrate`  | drizzle-kit migrate — apply migrations to the **local** db     |

All `db:*` scripts target `127.0.0.1:54322` directly.

## Gotchas

1. **`db:push` is local-only** — never push straight to the remote.
2. **Generate migrations on your branch, before the PR** — reviewers should see
   the exact SQL that will run on the remote.
3. **Supabase CLI does not apply schema migrations** — drizzle-kit owns
   `supabase/migrations/`. The Supabase CLI is only used here for the local Docker
   stack.
4. **Mailpit is local-only** — magic-link email is caught at
   `http://127.0.0.1:54324`, not a real inbox.
