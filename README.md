# Dashboard

A [Next.js](https://nextjs.org) app backed by a local [Supabase](https://supabase.com)
stack (Postgres + Auth) in Docker, with [Drizzle ORM](https://orm.drizzle.team) for
the schema.

## Prerequisites

- [pnpm](https://pnpm.io) — the only supported package manager
- Docker, **running** (the local Supabase stack runs in containers)

## Run it

Set up [environment variables](docs/local-development.md#environment-variables) before your first run.

```bash
pnpm install           # deps + the Supabase CLI
pnpm db:start          # boot the local Supabase stack (Docker) + write .env.local
pnpm db:push           # apply the schema to the local db
pnpm dev               # serve the app
```

Open [http://localhost:3000](http://localhost:3000). Edit pages under `app/`; they
hot-reload on save.

## Docs

- [Development workflow](docs/development.md)
- [Local development](docs/local-development.md)
- [Remote development](docs/remote-development.md)
- [Development tools](docs/development-tools.md)
- [Writing docs](docs/writing.md)

## Deploy

See [Remote development](docs/remote-development.md).
