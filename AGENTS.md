# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

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

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on pushes/PRs to `main`: Prettier check, ESLint, then `pnpm build`. Prettier and ESLint steps use `continue-on-error: true`, so only a broken build blocks the workflow.
