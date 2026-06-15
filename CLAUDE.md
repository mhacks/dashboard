# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # start dev server at localhost:3000
pnpm build        # production build
pnpm lint         # run ESLint (next/core-web-vitals + typescript)
pnpm format       # run Prettier (write mode)
pnpm prettier --check .  # check formatting without writing
```

Package manager is **pnpm** (v10). There are no tests configured yet.

## Architecture

Next.js 16 App Router project using React 19 and TypeScript.

- `app/` — App Router pages and layouts. `layout.tsx` sets up global fonts (Geist Sans + Geist Mono via `next/font/google`) and imports `globals.css`.
- `components/ui/` — shadcn/ui components copied into the repo (not imported from a package). Add new shadcn components with `pnpm shadcn add <component>`.
- `lib/utils.ts` — `cn()` helper (clsx + tailwind-merge) used everywhere for conditional Tailwind classes.
- `public/` — static image assets (several background/flower images already present for design reference).

## Styling

Tailwind CSS v4 with the shadcn `radix-nova` style. Theme tokens (colors, radius, fonts) are defined as CSS variables in `app/globals.css` and surfaced to Tailwind via `@theme inline`. Dark mode uses a `.dark` class strategy (`@custom-variant dark (&:is(.dark *))`).

The `components.json` shadcn config uses:

- Style: `radix-nova`
- Base color: `neutral`
- CSS variables: enabled
- Icon library: `lucide-react`
- Path aliases: `@/components`, `@/lib`, `@/hooks`

## Database

**Drizzle ORM** (`drizzle-orm` + `postgres`) is the only way to query the database — do not use the Supabase JS data API (`supabase.from(...)`) for data access. The Supabase JS client (`@supabase/ssr`) is used exclusively for **auth** (session management, `getUser()`).

- Schema: `lib/db/schema.ts` — edit this file, then run `pnpm db:generate` to emit a migration.
- DB client: `lib/db/index.ts` — exports `db` (Drizzle instance) and `schema`.
- Supabase auth client: `lib/supabase/server.ts` — server-side cookie-based client for auth only.
- Migrations live in `supabase/migrations/` and are applied by the Supabase CLI (`pnpm db:reset` / `supabase db push`). Raw SQL migrations (FKs to `auth.users`, triggers) sit alongside Drizzle-generated ones — don't overwrite them with `drizzle-kit push`.

Local DB commands:
```bash
pnpm db:start     # start local Supabase (Docker)
pnpm db:stop      # stop local Supabase
pnpm db:reset     # reset and re-apply all migrations
pnpm db:generate  # generate a new Drizzle migration from schema changes
pnpm db:studio    # open Drizzle Studio
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on pushes/PRs to `main`: Prettier check, ESLint, then `pnpm build`. Prettier and ESLint steps use `continue-on-error: true`, so only a broken build blocks the workflow.
