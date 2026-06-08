# Supabase: local → remote workflow

This project uses Supabase for both the **database** (via Drizzle ORM) and
**auth** (magic-link, via `@supabase/ssr`). This doc explains how work flows
from your local machine to the shared remote project.

> For the quick DB-only version, see the **Database & schema workflow** section
> of the [README](../README.md). This doc is the complete picture, including auth.
> For the step-by-step *process* (what to run and when, plus the git/merge
> workflow), see [`docs/development.md`](./development.md).

---

## Mental model: three things, three promotion paths

"Supabase" is really three separate concerns, and each gets to the remote a
different way. Don't assume they move together.

| Concern                                   | Owned by          | Local source            | Promote to remote via                       |
| ----------------------------------------- | ----------------- | ----------------------- | ------------------------------------------- |
| **DB schema** (tables, columns)           | Drizzle           | `lib/db/schema.ts`      | `db:migrate` with the remote `DATABASE_URL` |
| **Platform config** (auth, email templates) | `config.toml`   | `supabase/config.toml`  | `supabase config push`                      |
| **App → Supabase connection** (auth clients) | env vars        | `.env`                  | env vars set on your hosting platform       |

---

## The local stack

`pnpm db:local` (= `supabase start`) boots a full Supabase in Docker:

| Service | URL                      | Purpose                          |
| ------- | ------------------------ | -------------------------------- |
| Postgres| `127.0.0.1:54322`        | the database                     |
| API/Auth| `127.0.0.1:54321`        | what the auth clients talk to    |
| Studio  | `127.0.0.1:54323`        | DB GUI (`pnpm db:studio`)        |
| Mailpit | `127.0.0.1:54324`        | catches outgoing emails locally  |

Everything about the local stack is configured by
[`supabase/config.toml`](../supabase/config.toml) — ports, auth rules, and the
magic-link email template. **Config changes only take effect on restart:**
`pnpm db:local:stop` then `pnpm db:local`.

`pnpm db:local:reset` wipes the local DB and re-applies all migrations from
scratch — your reset button.

---

## Auth code map

| File                                                       | Runs in                                            | Role                                            |
| ---------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| [`lib/supabase/client.ts`](../lib/supabase/client.ts)      | Client Components (`"use client"`)                 | browser Supabase client                         |
| [`lib/supabase/server.ts`](../lib/supabase/server.ts)      | Server Components / Route Handlers / Server Actions| request-scoped server client (reads cookies)    |
| [`lib/supabase/middleware.ts`](../lib/supabase/middleware.ts) | middleware                                      | `updateSession()` — refreshes token, syncs cookies |
| [`middleware.ts`](../middleware.ts)                        | every request                                      | runs `updateSession` (excludes static assets)   |
| [`app/auth/confirm/route.ts`](../app/auth/confirm/route.ts)| Route Handler                                      | verifies magic-link `token_hash`, sets session  |

All three clients read the **same two env vars** —
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Whatever
those resolve to is the Supabase instance the app talks to. There is **no**
automatic local/remote switching.

### Magic-link flow

1. App calls `supabase.auth.signInWithOtp({ email })`.
2. Supabase sends an email using the
   [`magic_link.html`](../supabase/templates/magic_link.html) template, which
   links to `/auth/confirm?token_hash=...&type=magiclink`.
3. [`app/auth/confirm/route.ts`](../app/auth/confirm/route.ts) calls
   `verifyOtp`, establishes the session cookie, and redirects.

> The custom template is what makes the SSR (token-hash) flow work. The
> **default** Supabase template links to Supabase's own verify endpoint and
> bypasses our confirm route — so the template **must** be present both locally
> (`config.toml`) and remotely (`config push`).

Locally, the email lands in **Mailpit** (`http://127.0.0.1:54324`), not a real
inbox.

---

## Day-to-day: develop locally

Per the project convention, **every branch develops against its own local
database.** The shared remote is only touched from `main` after merge.

```bash
pnpm db:local          # boot the Docker stack (requires Docker running)

# --- schema changes (Drizzle owns these) ---
# edit lib/db/schema.ts ...
pnpm db:push           # push schema straight to LOCAL db — instant, disposable

# --- app + auth ---
pnpm dev               # app talks to localhost; magic-link emails → Mailpit
```

Iterate freely with `db:push` locally — no migration files, so no merge
conflicts. Keep schema changes **additive** (new tables / nullable columns)
until merged. `pnpm db:studio` opens a GUI to inspect data.

---

## Promote to the shared remote

Do this **from `main`, after merge** — not from feature branches.

### One-time: link the CLI to the remote project

```bash
pnpm supabase login
pnpm supabase link --project-ref <ref>   # <ref> is in your project's dashboard URL
```

### 1. DB schema → remote (Drizzle, **not** `supabase db push`)

```bash
pnpm db:generate       # turn the schema delta into a committed migration in drizzle/
# commit the generated migration file, then:
DATABASE_URL="<remote-pooler-url>" pnpm db:migrate
```

- Use the **Transaction pooler** string (port `6543`) from
  **Supabase Dashboard → Connect → ORMs**. That's why
  [`lib/db/index.ts`](../lib/db/index.ts) sets `prepare: false`.
- The inline `DATABASE_URL` overrides `.env`, so the remote can't be touched by
  accident. **Never** run `db:migrate` against local, and **never** run
  `db:push` against the remote.
- Migration files in `drizzle/` are the single source of truth for the remote's
  schema.

### 2. Platform config (auth + email template) → remote

```bash
pnpm supabase config push
```

The auth settings and email template in `config.toml` only configure the
**local** stack until you push them. Without this, remote logins use the wrong
redirect (see the magic-link note above). Also update for production:

- `site_url` / `additional_redirect_urls` → your real domain (currently
  `127.0.0.1:3000`).
- A real **SMTP provider** (`[auth.email.smtp]`) — Mailpit is local-only, so the
  remote can't send email without it.

### 3. App connection → remote (hosting env)

Set these as environment variables on whatever platform hosts the deployed app:

| Variable                            | Value (from Dashboard → Settings → API) |
| ----------------------------------- | --------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`          | remote project URL                      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | remote publishable key               |
| `DATABASE_URL`                      | remote Transaction pooler string        |

> ⚠️ The `NEXT_PUBLIC_*` vars are **inlined at build time**, not read at runtime.
> Changing them requires a **rebuild/redeploy** — you can't flip local↔remote by
> editing env on an already-built deployment.

---

## End-to-end summary

```text
LOCAL DEV (any branch)
  pnpm db:local                       # boot Docker stack
  edit lib/db/schema.ts → db:generate → db:push
  pnpm dev                            # app → localhost, emails → Mailpit
  commit drizzle/*.sql

SHIP TO REMOTE (from main, after merge)
  DATABASE_URL="<remote pooler>" pnpm db:migrate   # 1. schema
  pnpm supabase config push                        # 2. auth config + email template
  # 3. (hosting platform) set NEXT_PUBLIC_SUPABASE_* + DATABASE_URL, then redeploy
```

---

## Gotchas

1. **Schema and config promote separately.** Drizzle migrate (inline URL) for
   schema; `supabase config push` for auth/config. Forgetting the second is the
   most common mistake.
2. **The magic-link template must be pushed**, or remote logins redirect to the
   wrong place.
3. **`NEXT_PUBLIC_*` is build-time** — flipping local↔remote needs a rebuild.
4. **Mailpit is local-only** — the remote needs real SMTP configured to send
   magic-link emails.
5. **Local default keys are safe to commit** (they're well-known dev values);
   remote keys and the remote `DATABASE_URL` are **not** — keep them in your
   hosting platform's env settings / a password manager.
