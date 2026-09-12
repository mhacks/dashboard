---
name: regenerate-migrations
description: Regenerates unmerged Drizzle migrations by deleting branch-only files relative to main, then running pnpm db:generate with a meaningful name. Use whenever a migration needs to be modified, when editing schema that already has a branch migration, when consolidating branch SQL, or when check-migrations.mjs says a timestamp would be skipped.
compatibility: Requires git, pnpm, Node.js, and a Drizzle-managed supabase/migrations directory.
---

# Regenerate branch migrations

Do not edit an unmerged migration SQL file or its snapshot by hand. Delete branch-only migration files relative to main, then regenerate from the current schema.

## Workflow

- [ ] Step 1: Resolve the base ref
- [ ] Step 2: Restore main's migrations and delete branch-only files
- [ ] Step 3: Generate a new migration with a meaningful name
- [ ] Step 4: Validate the journal and run check-migrations.mjs

## Steps

1. **Base ref** is `origin/main` if it exists, otherwise `main`. Never delete files that exist on that ref.

2. **Restore main's migrations**, then **delete only what this branch added**:

```bash
BASE=$(git rev-parse --verify origin/main >/dev/null 2>&1 && echo origin/main || echo main)
git checkout "$BASE" -- supabase/migrations/
git diff --name-only --diff-filter=A "$BASE" -- supabase/migrations/ | while IFS= read -r f; do
  git rm -f -- "$f"
done
git ls-files --others --exclude-standard -- supabase/migrations/ | while IFS= read -r f; do
  rm -f -- "$f"
done
```

3. **Generate** from the current schema with a snake_case name that describes the schema (tables/columns), matching tags like `user_groups` or `broadcast_logs_and_deliveries`. Not `update`, `fix`, or `wip`.

```bash
pnpm db:generate --name=<meaningful_name>
```

4. Confirm `supabase/migrations/meta/_journal.json` still contains every tag from `$BASE`, plus the new entry. Then:

```bash
node scripts/check-migrations.mjs
```

## Gotchas

- If the branch-added migration list is empty, skip the delete step.
- Do not empty `supabase/migrations/` or run this workflow on `main` when there is no branch delta.
- If local Postgres already applied the old branch tag, reset it with `pnpm db:reset`.
