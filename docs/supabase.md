# How Supabase is wired in

Reference for the moving parts. For the _workflow_ — what to run and when to get a
change from local to the remote — see [docs/development.md](./development.md).

## Three concerns

"Supabase" here is really three separate concerns. Each has its own local source
and its own path to the remote — they do **not** move together.

| Concern                                     | Owned by      | Local source           | Promotes to remote via               |
| ------------------------------------------- | ------------- | ---------------------- | ------------------------------------ |
| **DB schema** (tables, columns)             | Drizzle       | `lib/db/schema.ts`     | `db:migrate` (remote `DATABASE_URL`) |
| **Platform config** (auth, email templates) | `config.toml` | `supabase/config.toml` | `supabase config push`               |
| **App ↔ Supabase connection** (env)         | env vars      | `.env`                 | env vars on your hosting platform    |

## The local stack

`pnpm db:local` (= `supabase start`) boots a full Supabase in Docker:

| Service  | URL               | Purpose                                   |
| -------- | ----------------- | ----------------------------------------- |
| Postgres | `127.0.0.1:54322` | the database (`DATABASE_URL` points here) |
| API/Auth | `127.0.0.1:54321` | what the auth clients talk to             |
| Studio   | `127.0.0.1:54323` | Supabase Studio — DB GUI                  |
| Mailpit  | `127.0.0.1:54324` | catches outgoing email locally            |

Supabase Studio is already running once the stack is up — open it to inspect data.
Everything here is configured by [`supabase/config.toml`](../supabase/config.toml),
which is read only at boot (restart after editing it).

## Auth

The app uses magic-link auth via `@supabase/ssr`. There are three clients, one per
runtime, all reading the same `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — whatever those resolve to is the instance
the app talks to (there's no automatic local/remote switching).

| File                                                                        | Runs in                                      | Role                                                   |
| --------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| [`lib/supabase/client.ts`](../lib/supabase/client.ts)                       | Client Components                            | browser client                                         |
| [`lib/supabase/server.ts`](../lib/supabase/server.ts)                       | Server Components / Route Handlers / Actions | request-scoped server client (reads cookies)           |
| [`lib/supabase/middleware.ts`](../lib/supabase/middleware.ts)               | middleware                                   | `updateSession()` — refreshes token, syncs cookies     |
| [`app/example/auth/confirm/route.ts`](../app/example/auth/confirm/route.ts) | Route Handler                                | verifies the magic-link `token_hash`, sets the session |

[`middleware.ts`](../middleware.ts) runs `updateSession` on every request (minus
static assets).

### Magic-link flow

1. App calls `supabase.auth.signInWithOtp({ email })`.
2. Supabase sends the [`magic_link.html`](../supabase/templates/magic_link.html)
   template, which links to `/example/auth/confirm?token_hash=...&type=magiclink`.
3. [`app/example/auth/confirm/route.ts`](../app/example/auth/confirm/route.ts) calls `verifyOtp`,
   sets the session cookie, and redirects.

> The **custom** template is what makes the token-hash (SSR) flow work; the default
> links to Supabase's own verify endpoint and bypasses our confirm route. So the
> template must exist both locally (`config.toml`) and remotely (`config push`).

Locally, the email lands in **Mailpit** (`http://127.0.0.1:54324`), not a real
inbox.
