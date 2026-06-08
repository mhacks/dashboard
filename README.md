This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Database & schema workflow

> 📖 For the complete Supabase picture — **auth** (magic-link), platform config,
> and the full local→remote promotion flow — see [docs/supabase.md](docs/supabase.md).
> The section below is the DB-only quick reference.

We use **Drizzle ORM** against **Supabase Postgres**. To avoid branches clobbering
each other's schema on the shared remote, **every branch develops against its own
local database**, and migrations are the only thing that touches the shared remote
— applied from `main` after merge.

### One-time setup

1. Install deps: `pnpm install` (this also installs the Supabase CLI).
2. Make sure **Docker is running**.
3. Copy the env template: `cp .env.example .env` (the default local connection
   string already works — no edits needed).

### Day-to-day (on any feature branch)

```bash
pnpm db:local          # start the local Supabase Postgres (Docker)
# edit lib/db/schema.ts ...
pnpm db:push           # push your schema straight to the LOCAL db — instant, disposable
pnpm dev               # app runs against your local db
```

`pnpm db:studio` opens a browser UI to inspect data. `pnpm db:local:reset` wipes the
local db; `pnpm db:local:stop` shuts it down.

Iterate freely with `db:push` locally — no migration files, so no merge conflicts.
Keep schema changes **additive** (new tables / nullable columns) until merged.

### Applying changes to the shared remote (do this from `main`, after merge)

```bash
pnpm db:generate       # turn the schema delta into a committed migration file (in drizzle/)
# commit the generated migration, then:
DATABASE_URL="<remote-pooler-url>" pnpm db:migrate   # apply to the shared remote
```

The inline `DATABASE_URL` (the Transaction pooler string from
**Supabase Dashboard → Connect → ORMs**) overrides `.env`, so the remote is never
touched by accident. Migration files live in git and are the single source of truth
for the remote's schema. **Never run `db:migrate` against your local db, and never
run `db:push` against the remote.**

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy

See [docs/development.md](docs/development.md#4-connect-main-to-the-remote) for the
local → remote promotion flow. Set `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `DATABASE_URL` as environment variables
on whatever platform hosts the deployed app. For Next.js hosting options in
general, see the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).
