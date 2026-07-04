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

Supabase Studio is available once the stack is up. Local auth/email settings live in
[`supabase/config.toml`](../supabase/config.toml) — restart the stack after editing
it (`pnpm db:stop` then `pnpm db:start`).

`db:start` runs [`scripts/gen-env-local.sh`](../scripts/gen-env-local.sh), which reads
`supabase status` and writes `.env.local` (git-ignored). Re-run
`pnpm db:env` if the stack is already up and you need fresh env values.

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
