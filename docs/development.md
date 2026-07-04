# Development workflow

How a change travels from your laptop to the shared remote.

- [Local development](./local-development.md)
- [Remote development](./remote-development.md)
- [Development tools](./development-tools.md)
- [Writing docs](./writing.md)

## Ownership

Three layers, three owners. They promote to the remote **independently** — merging
a PR lands code on `main` but does not update production until each layer is applied
by hand.

| Layer           | Owner            | Source in repo                             | Promote locally                        | Promote to remote                             |
| --------------- | ---------------- | ------------------------------------------ | -------------------------------------- | --------------------------------------------- |
| Database schema | **Drizzle**      | `lib/db/schema.ts`, `supabase/migrations/` | `db:push`, `db:generate`, `db:migrate` | `drizzle-kit migrate` (pooler `DATABASE_URL`) |
| Platform config | **Supabase CLI** | `supabase/config.toml` + root `.env` (secrets) | read at `db:start` (base `[auth]`)     | `supabase config push` (merges `[remotes.production]`) |
| App connection  | **Env vars**     | `.env.local` (generated)                   | `db:env`                               | hosting platform dashboard + redeploy         |

**Drizzle owns schema migrations, not Supabase.** drizzle-kit reads
`supabase/migrations/` and tracks applied files in `__drizzle_migrations`. The
Supabase CLI runs the local Docker stack (Postgres, Auth API, Studio, Mailpit) and
syncs `config.toml` auth/email settings to the remote dashboard via `config push` — it
does not apply schema changes.
