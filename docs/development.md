# Development process: local → remote

This is the end-to-end guide to how a change travels from your laptop to the
shared remote. It walks the lifecycle in order:

1. [Start the local stack](#1-start-the-local-stack) (database / auth / Supabase)
2. [Develop and update the schema with Drizzle](#2-develop-and-update-the-schema-with-drizzle)
3. [Merge your branch into `main`](#3-merge-your-branch-into-main)
4. [Connect `main` to the remote](#4-connect-main-to-the-remote)

> **Companion doc:** [`docs/supabase.md`](./supabase.md) explains the *mechanics*
> of Supabase (the three clients, the magic-link auth flow, what `config.toml`
> owns). This doc is the *process* — the order of operations and the git workflow
> around it. When in doubt about "what does this Supabase piece do," read that;
> for "what do I run, and when," read this.

---

## The core rule

**Every branch develops against its own local database. The shared remote is
only ever touched from `main`, after merge.**

This is the single decision the whole workflow hangs on. Locally you iterate with
`db:push` (no migration files, instantly disposable, no merge conflicts). The
remote is only ever changed by **committed migration files**, applied from `main`.
That keeps two people's in-flight schema changes from clobbering each other on a
shared database.

"Supabase" is actually three separate concerns, and each promotes to the remote
its own way — they do **not** move together:

| Concern                                      | Local source           | Promotes to remote via                      |
| -------------------------------------------- | ---------------------- | ------------------------------------------- |
| **DB schema** (tables, columns)              | `lib/db/schema.ts`     | `db:migrate` with the remote `DATABASE_URL` |
| **Platform config** (auth, email templates)  | `supabase/config.toml` | `supabase config push`                      |
| **App → Supabase connection** (env vars)     | `.env`                 | env vars set on your hosting platform       |

---

## 0. One-time setup

Do this once per machine.

```bash
pnpm install              # installs deps + the Supabase CLI (it's a devDependency)
# make sure Docker Desktop is running — the local stack runs in containers
```

You do **not** need to hand-write `.env` — it's generated from the running stack
in the next step.

---

## 1. Start the local stack

`pnpm db:local` boots a full Supabase in Docker (Postgres + Auth/API + Studio +
Mailpit). Then generate your `.env` from what the stack reports:

```bash
pnpm db:local            # boot the Docker stack (Postgres, Auth, Studio, Mailpit)
pnpm db:env              # write .env from `supabase status` (the live local values)
pnpm db:push             # apply the current schema to the fresh local db
pnpm dev                 # run the app against localhost
```

What's now running:

| Service  | URL                 | Purpose                                  |
| -------- | ------------------- | ---------------------------------------- |
| Postgres | `127.0.0.1:54322`   | the database (`DATABASE_URL` points here)|
| API/Auth | `127.0.0.1:54321`   | what the Supabase auth clients talk to   |
| Studio   | `127.0.0.1:54323`   | DB GUI — also `pnpm db:studio`           |
| Mailpit  | `127.0.0.1:54324`   | catches outgoing emails locally          |

Notes:

- **`pnpm db:env`** runs [`scripts/gen-env.ts`](../scripts/gen-env.ts), which
  reads `supabase status` and writes `.env`. The local DB URL and Supabase keys
  come straight from the running stack; the auth redirect URLs are *preserved*
  from your existing `.env` (or default to `http://localhost:3000`). Re-run it any
  time the stack's values change. `.env` is git-ignored — never committed.
- **Magic-link auth runs fully locally.** Logging in sends an email that lands in
  **Mailpit** (`http://127.0.0.1:54324`), not a real inbox. See the magic-link
  flow in [`docs/supabase.md`](./supabase.md#magic-link-flow).
- **Config changes need a restart.** `supabase/config.toml` (ports, auth rules,
  email template) is only read at boot. After editing it:
  `pnpm db:local:stop` then `pnpm db:local`.

Handy lifecycle commands:

| Command                  | Does                                                          |
| ------------------------ | ------------------------------------------------------------ |
| `pnpm db:local`          | start the stack                                              |
| `pnpm db:local:stop`     | stop the stack                                               |
| `pnpm db:local:reset`    | **wipe** the local db and re-apply all migrations from `drizzle/` |
| `pnpm db:local:restart`  | stop → start → `db:push` (fresh stack with current schema)   |
| `pnpm db:studio`         | open the Drizzle Studio GUI                                  |

---

## 2. Develop and update the schema with Drizzle

The schema lives in [`lib/db/schema.ts`](../lib/db/schema.ts) — Drizzle is the
single owner of table/column definitions. The local inner loop:

```bash
# 1. edit lib/db/schema.ts (add a table, a column, etc.)
# 2. push it straight to your LOCAL db — instant, no migration file:
pnpm db:push
# 3. iterate in the app / inspect with `pnpm db:studio`
```

Iterate freely: `db:push` diffs the schema against your local db and applies the
change directly. No migration file is written, so there's nothing to conflict on
a branch.

Two conventions that keep merges painless:

- **Keep schema changes additive** (new tables, nullable columns) until merged.
  Destructive changes on a shared remote are where pain lives.
- **Don't generate migration files mid-branch.** Use `db:push` while iterating.
  You only generate the migration once, right before merge (next step), so the
  committed migration reflects the *final* shape of your change — not every
  intermediate edit.

The Drizzle commands and what they touch:

| Command            | Target          | When                                                       |
| ------------------ | --------------- | ---------------------------------------------------------- |
| `pnpm db:push`     | **local** db    | day-to-day iteration on a branch                           |
| `pnpm db:generate` | writes `drizzle/*.sql` | once, before merge — turns the schema delta into a committed migration |
| `pnpm db:migrate`  | **remote** db   | from `main`, applies committed migrations (see §4)         |

> ⚠️ **Never `db:push` against the remote, and never `db:migrate` against local.**
> `db:push` is the disposable local tool; `db:migrate` + committed files are the
> auditable remote path.

---

## 3. Merge your branch into `main`

This is where the disposable local schema becomes a permanent, committed
migration.

```bash
# on your feature branch, with the schema in its FINAL shape:
pnpm db:generate          # diff schema.ts → write a new migration into drizzle/
```

`db:generate` compares `lib/db/schema.ts` against the snapshot in
[`drizzle/meta/`](../drizzle/meta) and writes a new `drizzle/NNNN_*.sql` file plus
an updated snapshot. **Commit these** — the `drizzle/` directory is the single
source of truth for the remote's schema, and migrations apply in numbered order.

Then open the PR as usual:

```bash
git add lib/db/schema.ts drizzle/
git commit -m "Add <thing> to schema"
git push -u origin <your-branch>
# open a PR against main
```

On the PR, CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) runs
Prettier, ESLint, and a production build. CI does **not** touch any database — it
only checks the app builds. Schema correctness is your responsibility via local
testing.

Verify before merging:

- The generated `drizzle/*.sql` reads the way you expect (no surprise drops).
- Sanity-check it applies from scratch: `pnpm db:local:reset` re-runs **all**
  migrations on a clean db. If that succeeds, the same files will apply cleanly to
  the remote.

Then merge the PR into `main`. **Merging does not change the remote database** —
it only lands the migration files in `main`. The remote is updated in the next,
deliberate step.

---

## 4. Connect `main` to the remote

Do this **from `main`, after merge** — never from a feature branch. Recall the
three concerns promote separately.

### One-time: link the CLI to the remote project

```bash
pnpm supabase login
pnpm supabase link --project-ref <ref>   # <ref> is in the project's dashboard URL
```

### 4a. DB schema → remote (Drizzle migrate)

```bash
git checkout main && git pull            # get the merged migration files
DATABASE_URL="<remote-pooler-url>" pnpm db:migrate
```

- Use the **Transaction pooler** string (host ends in `pooler.supabase.com`, port
  `6543`) from **Supabase Dashboard → Connect → ORMs**. That pooled mode is why
  [`lib/db/index.ts`](../lib/db/index.ts) sets `prepare: false`.
- The **inline `DATABASE_URL` overrides `.env`**, so the remote can only be hit
  on purpose — your `.env` stays pointed at local. This is the guard against
  accidental remote writes.
- `db:migrate` applies any migration files the remote hasn't seen yet, in order.
  It's safe to re-run; already-applied migrations are skipped.

### 4b. Platform config (auth + email template) → remote

```bash
pnpm supabase config push
```

`supabase/config.toml` only configures your **local** stack until pushed. This is
the **most-forgotten step**: skip it and remote magic-link logins redirect to the
wrong place (the custom `magic_link.html` template must exist remotely). For
production also update, in `config.toml` / the dashboard:

- `site_url` / `additional_redirect_urls` → your real domain (local default is
  `localhost:3000`).
- A real **SMTP provider** under `[auth.email.smtp]` — Mailpit is local-only, so
  the remote can't send email without it.

### 4c. App connection → remote (hosting env)

The deployed app talks to whatever its env vars resolve to — there's no automatic
local/remote switching. Set these as environment variables on whatever platform
hosts the deployed app:

| Variable                                | Value (Dashboard → Project Settings → API) |
| --------------------------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`              | remote project URL                         |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`  | remote publishable key                     |
| `DATABASE_URL`                          | remote Transaction pooler string           |

> ⚠️ `NEXT_PUBLIC_*` vars are **inlined at build time**, not read at runtime.
> Changing them requires a **rebuild/redeploy** — you can't flip an existing
> deployment between local and remote by editing env.

---

## End-to-end summary

```text
LOCAL DEV (any feature branch)
  pnpm db:local                  # boot Docker stack
  pnpm db:env                    # generate .env from the running stack
  edit lib/db/schema.ts → pnpm db:push   # iterate against LOCAL db (no migration files)
  pnpm dev                       # app → localhost, magic-link emails → Mailpit

MERGE (before opening the PR)
  pnpm db:generate               # schema delta → committed drizzle/*.sql
  commit lib/db/schema.ts + drizzle/, push, open PR → CI (lint/build) → merge to main
  # merging does NOT change the remote db

SHIP TO REMOTE (from main, after merge — three separate promotions)
  DATABASE_URL="<remote pooler>" pnpm db:migrate   # 4a. schema
  pnpm supabase config push                        # 4b. auth config + email template
  # 4c. (hosting platform) set NEXT_PUBLIC_SUPABASE_* + DATABASE_URL, then redeploy
```

---

## Gotchas

1. **Schema and config promote separately.** `db:migrate` (inline remote URL) for
   schema; `supabase config push` for auth/config. Forgetting the second is the
   most common mistake.
2. **`db:push` is local-only; `db:migrate` is remote-only.** Mixing them up either
   skips the audit trail or risks the shared db.
3. **Generate the migration once, at merge time** — not per-edit on the branch, or
   you'll commit a pile of intermediate migrations.
4. **`NEXT_PUBLIC_*` is build-time** — flipping local↔remote needs a rebuild.
5. **Mailpit is local-only** — the remote needs real SMTP to send magic-link
   emails.
6. **`.env` is generated and git-ignored.** Local default keys are well-known dev
   values; the remote `DATABASE_URL` and keys are secrets — keep them in your
   hosting platform's env settings / a password manager, never in a committed file.
```