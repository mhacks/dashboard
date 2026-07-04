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
pnpm db:start          # boot the local Supabase stack (Docker) + write .env.local
pnpm db:push           # apply the schema to the local db
pnpm dev               # serve the app
```

Open [http://localhost:3000](http://localhost:3000). Edit pages under `app/`; they
hot-reload on save.

## Docs

- **[docs/development.md](docs/development.md)** — overview, how Supabase is wired
  in, and links to the local/remote workflows.
- **[docs/local-development.md](docs/local-development.md)** — boot the stack,
  change the schema, generate a migration, open a PR.
- **[docs/remote-development.md](docs/remote-development.md)** — after merge to
  `main`, apply migrations and push auth config to the shared remote.

## Deploy

The app reads `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
and `DATABASE_URL` from the environment. Set them on your hosting platform and
redeploy — see [docs/remote-development.md](docs/remote-development.md).
