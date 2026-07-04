# Baseline existing databases

Your local (or remote) database may already have this schema and triggers.
**Do not re-run** migrations whose objects already exist — `CREATE TABLE` /
`CREATE TRIGGER` would fail.

Mark each migration as applied so future `drizzle-kit migrate` runs only apply
new files.

## One-time SQL (local or remote)

Run against the target database:

```sql
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

INSERT INTO "__drizzle_migrations" (hash, created_at)
SELECT hash, (extract(epoch from now()) * 1000)::bigint
FROM (VALUES
  ('8153b5589d8934bd2c1875e7207ca1318689e2a11506aa59bdc6d23bef0a2f1e'), -- 20260704050918_init.sql
  ('5f8669e7deaeca14161eb86a936dbbc05e3462a62c389b510645dcd006cdc1c1')  -- 20260704051214_triggers.sql
) AS migrations(hash)
WHERE NOT EXISTS (
  SELECT 1 FROM "__drizzle_migrations" m WHERE m.hash = migrations.hash
);
```

Recompute hashes if migration files change:

```bash
shasum -a 256 supabase/migrations/*.sql | awk '{print $1, $2}'
```

## Verify

```bash
pnpm local:db:migrate
```

Should report nothing pending.

## Migrations

| File | Purpose |
| --- | --- |
| `20260704050918_init.sql` | Tables, enums, FKs |
| `20260704051214_triggers.sql` | `set_updated_at` on applicant tables; `handle_new_user` on `auth.users` |
