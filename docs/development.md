# Development workflow

How a change travels from your laptop to the shared remote.

- **[Local development](./local-development.md)** — boot the stack, change the
  schema, generate a migration, open a PR.
- **[Remote development](./remote-development.md)** — after merge to `main`, apply
  migrations, push auth config, and update env vars on the hosting platform.
- **[Development tools](./development-tools.md)** — Tailwind, shadcn, React Hook
  Form, and Server Actions conventions.

## Ownership

Three layers, three owners. They promote to the remote **independently** — merging
a PR lands code on `main` but does not update production until each layer is applied
by hand.

| Layer            | Owner         | Source in repo                                 | Promote locally              | Promote to remote                              |
| ---------------- | ------------- | ---------------------------------------------- | ---------------------------- | ---------------------------------------------- |
| Database schema  | **Drizzle**   | `lib/db/schema.ts`, `supabase/migrations/`     | `db:push`, `db:generate`, `db:migrate` | `drizzle-kit migrate` (pooler `DATABASE_URL`) |
| Platform config  | **Supabase CLI** | `supabase/config.toml`                      | read at `db:start`           | `supabase config push`                         |
| App connection   | **Env vars**  | `.env.local` (generated)                       | `db:env`                     | hosting platform dashboard + redeploy          |

**Drizzle owns schema migrations, not Supabase.** drizzle-kit reads
`supabase/migrations/` and tracks applied files in `__drizzle_migrations`. The
Supabase CLI runs the local Docker stack (Postgres, Auth API, Studio, Mailpit) and
pushes auth/email config — it does not apply schema changes.

For step-by-step commands, see [local development](./local-development.md) and
[remote development](./remote-development.md).
