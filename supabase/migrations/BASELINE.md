# Baseline existing databases

Your local (or remote) database already has this schema. **Do not run**
`20260704050918_init.sql` against it — `CREATE TABLE` would fail.

After the squash, mark the migration as applied so future
`drizzle-kit migrate` runs only apply new files.

## One-time SQL (local or remote)

Run against the target database:

```sql
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

INSERT INTO "__drizzle_migrations" (hash, created_at)
SELECT '8153b5589d8934bd2c1875e7207ca1318689e2a11506aa59bdc6d23bef0a2f1e', (extract(epoch from now()) * 1000)::bigint
WHERE NOT EXISTS (
  SELECT 1 FROM "__drizzle_migrations"
  WHERE hash = '8153b5589d8934bd2c1875e7207ca1318689e2a11506aa59bdc6d23bef0a2f1e'
);
```

The hash above is the SHA-256 digest of `20260704050918_init.sql`. Recompute
if that file changes:

```bash
shasum -a 256 supabase/migrations/20260704050918_init.sql | awk '{print $1}'
```

## Verify

```bash
pnpm local:db:migrate
```

Should report nothing pending. Old DB triggers (`set_updated_at`,
`handle_new_user`) are unused by the app but harmless until you drop them
manually.
