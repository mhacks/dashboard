# Local development

## The rule

**Every branch develops against its own local database.**

Iterate with `db:push` (drizzle-kit push) for fast feedback, then generate a
migration file on your branch before opening a PR. The remote is never touched
during local development.

## 1. Start the local stack

`pnpm db:start` (= `supabase start` + bucket seeding + env generation) boots a full Supabase stack in
Docker:

| Service  | URL                             | Purpose                                   |
| -------- | ------------------------------- | ----------------------------------------- |
| Postgres | `127.0.0.1:54322`               | the database (`DATABASE_URL` points here) |
| API/Auth | `127.0.0.1:54321`               | what the auth clients talk to             |
| Storage  | `127.0.0.1:54321/storage/v1/s3` | S3-compatible API for resume uploads      |
| Studio   | `127.0.0.1:54323`               | Supabase Studio — DB GUI                  |
| Mailpit  | `127.0.0.1:54324`               | catches outgoing email locally            |

```bash
pnpm db:start       # boot Supabase in Docker + write .env.local
pnpm db:push        # apply the current schema to the fresh local db
pnpm dev            # run the app against localhost
```

Supabase Studio is available once the stack is up. [`supabase/config.toml`](../supabase/config.toml)
is the source of truth for auth rules, email templates, SMTP, `site_url`, and redirect
URLs — restart the stack after editing it (`pnpm db:stop` then `pnpm db:start`).

The base `[auth]` block in `config.toml` holds **local** values (e.g.
`http://127.0.0.1:3000`, SMTP disabled so Inbucket/Mailpit catches email). Production
overrides live in `[remotes.production]` and are only applied on `pnpm supabase config push` —
see [Remote development](./remote-development.md).

`db:start` runs [`scripts/gen-env-local.sh`](../scripts/gen-env-local.sh), which reads
`supabase status` and writes `.env.local` (git-ignored). Re-run
`pnpm db:env` if the stack is already up and you need fresh env values.

### Resume storage (local)

Resume uploads go through [`lib/aws/s3.ts`](../lib/aws/s3.ts). The same code runs in
every environment; `.env.local` sets `RESUMES_REGION=local` so the client uses
Supabase Storage instead of AWS. Production uses `us-east-2` — see
[Remote development](./remote-development.md).

**Bucket definition** — the `[storage.buckets.resumes]` block in
[`supabase/config.toml`](../supabase/config.toml) declares the local bucket name and
limits (private, PDF only, 10 MiB). This block is for **local seeding only**; it is
not applied to the remote Supabase project by `config push` or `db push`.

**Bucket creation** — declaring a bucket in `config.toml` does not create it by itself.
`pnpm db:start` runs `supabase seed buckets`, which reads those blocks and creates the
bucket in local Storage. `pnpm db:reset` wipes Postgres (including storage metadata), so
it re-runs `supabase seed buckets` afterward.

**Env wiring** — [`scripts/gen-env-local.sh`](../scripts/gen-env-local.sh) reads
`supabase status` and writes `.env.local`:

| Variable                    | Purpose                                  |
| --------------------------- | ---------------------------------------- |
| `RESUMES_REGION`            | `local` — selects Supabase Storage       |
| `RESUMES_S3_URL`            | local Storage URL from `supabase status` |
| `RESUMES_BUCKET`            | `resumes` (matches `config.toml`)        |
| `RESUMES_ACCESS_KEY_ID`     | local Storage access key                 |
| `RESUMES_SECRET_ACCESS_KEY` | local Storage secret key                 |

To add another local bucket, add a `[storage.buckets.<name>]` block to `config.toml`,
restart or re-seed (`pnpm db:start` or `supabase seed buckets --yes`), and update
`RESUMES_BUCKET` in `.env.local`.

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
| `pnpm db:start`    | start Supabase, seed local storage buckets, write `.env.local` |
| `pnpm db:stop`     | stop the stack                                                 |
| `pnpm db:reset`    | wipe local Postgres, then re-seed storage buckets              |
| `pnpm db:env`      | (re)generate `.env.local` from the running stack               |
| `pnpm db:push`     | drizzle-kit push — apply `schema.ts` to the **local** db       |
| `pnpm db:generate` | drizzle-kit generate — write a migration from the schema delta |
| `pnpm db:migrate`  | drizzle-kit migrate — apply migrations to the **local** db     |

All `db:*` scripts target `127.0.0.1:54322` directly.
