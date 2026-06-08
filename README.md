This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

This project uses **pnpm** as its package manager. First, run the development
server:

```bash
pnpm dev
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
3. Generate your `.env` in the day-to-day flow below — `pnpm db:env` writes it from
   the running local stack.

### Day-to-day (on any feature branch)

```bash
pnpm db:local          # start the local Supabase Postgres (Docker)
pnpm db:env            # generate .env from the running stack (`supabase status`)
# edit lib/db/schema.ts ...
pnpm db:push           # push your schema straight to the LOCAL db — instant, disposable
pnpm dev               # app runs against your local db
```

`pnpm db:env` runs [`scripts/gen-env.ts`](scripts/gen-env.ts), which reads
`supabase status` and writes `.env` (local DB URL + Supabase keys from the live
stack; auth redirect URLs preserved). Re-run it whenever the stack's values change.
`.env` is git-ignored.

`pnpm db:studio` opens a browser UI to inspect data. `pnpm db:local:reset` wipes the
local db; `pnpm db:local:stop` shuts it down.

Iterate freely with `db:push` locally — no migration files, so no merge conflicts.
Keep schema changes **additive** (new tables / nullable columns) until merged.
**Commit only `lib/db/schema.ts`** on a feature branch — never anything in `drizzle/`.

### Applying changes to the shared remote (do this from `main`, after merge)

Migrations are generated **on `main`, after merge** — never on a feature branch.
Migrations form one totally-ordered sequence (`0000`, `0001`, …); if two branches
each generated one before merging, they'd claim the same number and scramble the
order. Generating on `main` after each merge makes the sequence follow merge order.

```bash
git checkout main && git pull
pnpm db:generate       # turn the merged schema delta into a committed migration (in drizzle/)
git add drizzle/ && git commit -m "Generate migration" && git push
DATABASE_URL="<remote-pooler-url>" pnpm db:migrate   # apply to the shared remote
```

The inline `DATABASE_URL` (the Transaction pooler string from
**Supabase Dashboard → Connect → ORMs**) overrides `.env`, so the remote is never
touched by accident. Migration files live in git and are the single source of truth
for the remote's schema. **Never run `db:migrate` against your local db, and never
run `db:push` against the remote.**

> 📖 Full process — including auth config and the hosting env vars — is in
> [docs/development.md](docs/development.md).

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
