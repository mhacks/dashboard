# Dashboard

A [Next.js](https://nextjs.org) app backed by a local [Supabase](https://supabase.com)
stack (Postgres + Auth) in Docker, with [Drizzle ORM](https://orm.drizzle.team) for
the schema.

## Prerequisites

- [pnpm](https://pnpm.io) — the only supported package manager
- Docker, **running** (the local Supabase stack runs in containers)

## Run it

```bash
pnpm install           # deps + the Supabase CLI
pnpm db:local          # boot the local Supabase stack (Docker)
pnpm db:env            # generate .env from the running stack
pnpm db:push           # apply the schema to the local db
pnpm dev               # serve the app
```

Open [http://localhost:3000](http://localhost:3000). Edit pages under `app/`; they
hot-reload on save.

## Docs

- **[docs/development.md](docs/development.md)** — the workflow: what to run and
  when, from a local change to shipping it to the shared remote.
- **[docs/supabase.md](docs/supabase.md)** — how Supabase is wired in: the local
  stack, the auth clients, and the magic-link flow.

## Deploy

The app reads `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
and `DATABASE_URL` from the environment. Set them on your hosting platform and
redeploy — see [docs/development.md](docs/development.md#4-ship-to-the-remote) for
the full promotion flow.
