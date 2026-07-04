# Development tools

Conventions for UI, forms, and mutations in this app. Use these tools — not ad-hoc
alternatives — when building new pages and features.

## Tailwind CSS

**Use Tailwind for all styling.** Do not add CSS modules, styled-components, or
inline `style` props except where a value is truly dynamic (e.g. a computed color).

Tailwind v4 is imported in [`app/globals.css`](../app/globals.css). Theme tokens
(colors, radius, fonts) are CSS variables surfaced through `@theme inline`. Dark mode
uses a `.dark` class on an ancestor.

### Conventions

- **Semantic tokens first** — prefer `bg-background`, `text-foreground`,
  `border-border`, `text-destructive`, etc. over raw hex values.
- **Brand palette** — moss, olive, fern, sage, cream, ink, night, fog, paper, and
  haze are defined in `@theme inline` (e.g. `text-moss`, `bg-cream`).
- **Conditional classes** — use the `cn()` helper from [`lib/utils.ts`](../lib/utils.ts)
  (`clsx` + `tailwind-merge`) to merge class strings safely.
- **Fonts** — `font-sans`, `font-mono`, `font-heading`, and `font-red-hat` map to
  the fonts loaded in `app/layout.tsx`.

## shadcn/ui

**Use shadcn components for UI primitives.** Components live in
[`components/ui/`](../components/ui/) and are copied into the repo — they are not
installed as a runtime package.

```bash
pnpm shadcn add <component>   # e.g. pnpm shadcn add dialog
```

Configuration is in [`components.json`](../components.json) (style: `radix-nova`,
base color: `neutral`, CSS variables enabled, icons: `lucide-react`).

- Import from `@/components/ui/<name>` (e.g. `Button`, `Input`, `Card`, `Label`).
- Extend shadcn components with Tailwind classes via `className`; avoid forking the
  source unless the change is shared across the app.
- Compose primitives rather than building custom buttons, inputs, or dialogs from
  scratch.

## React Hook Form

**Use React Hook Form for all interactive forms.** Pair it with Zod schemas via
`@hookform/resolvers/zod` for client-side validation (UX feedback only — not a
security boundary).

Define the schema once (e.g. in `lib/types/`) and wire it into `useForm`:

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mySchema, type MyFormData } from "@/lib/types/my-form";

const {
  register,
  handleSubmit,
  control,
  formState: { errors },
} = useForm<MyFormData>({
  resolver: zodResolver(mySchema),
  mode: "onChange",
  defaultValues: {
    /* ... */
  },
});
```

### Field patterns

- **Simple inputs** — spread `register("fieldName")` onto shadcn `Input` /
  `Textarea` / `Checkbox`.
- **Controlled widgets** — use `Controller` for selects, OTP inputs, file uploads,
  or any component that does not accept a native `ref`.
- **Dependent fields** — use `useWatch` or `watch()` to react to other field values.
- **Errors** — read `errors.fieldName?.message` and render below the input.

Wrap fields in the `FormField` helper from [`app/apply/utils.tsx`](../app/apply/utils.tsx).
The repo does not use the shadcn `Form` wrapper — keep the `FormField` +
`register` / `Controller` pattern.

Client form components carry `"use client"` and call `useForm` (see
[`app/apply/application-form.tsx`](../app/apply/application-form.tsx),
[`app/login/page.tsx`](../app/login/page.tsx)). Validation schemas live next to
their types, not inside server action files.

## Server-side validation

**Always validate on the server before writing data.**

1. **Parse with Zod in every mutation** — call `mySchema.parse(data)` (or
   `safeParse` when returning field errors) before any database write. Define each
   schema once in `lib/types/` and import it in both the form and the server action.
2. **Auth and ownership on the server** — derive `userId` from `getUser()`, not from
   the request body.
3. **Stricter server rules when needed** — the server may enforce uniqueness, rate
   limits, or row ownership. Use a partial schema (e.g. `mySchema.partial()`) for
   drafts rather than skipping validation.

Reference: [`submitHackerApplication`](../lib/actions/application-form.server.actions.ts)
calls `hackerApplicationSchema.parse(data)` before inserting.

## Server Actions

**Use Server Actions for mutations and auth flows** — not API route handlers, unless
you need a public webhook or third-party callback.

Actions live in [`lib/actions/`](../lib/actions/) with a `.server.actions.ts` suffix
and a `"use server"` directive at the top of the file:

- [`lib/actions/auth.server.actions.ts`](../lib/actions/auth.server.actions.ts) —
  OTP login, logout, redirects
- [`lib/actions/application-form.server.actions.ts`](../lib/actions/application-form.server.actions.ts) —
  submit application, save draft
- [`lib/actions/resume.server.actions.ts`](../lib/actions/resume.server.actions.ts) —
  presigned resume upload/download URLs

Conventions:

- **Auth on the server** — call `createClient()` from `@/lib/supabase/server` and
  `getUser()` inside the action; never trust a client-supplied user id.
- **Database via Drizzle** — import `db` from `@/lib/db`; do not use
  `supabase.from(...)` for data access.
- **Return structured results** — return `{ error: string }` or domain-specific
  objects (e.g. `{ duplicate: boolean }`) instead of throwing for expected cases.
- **Redirects** — use `redirect()` from `next/navigation` inside the action when the
  success path should navigate (see `verifyOtp`, `logout`).

Call actions directly from client components — no `fetch`, no route handler.
