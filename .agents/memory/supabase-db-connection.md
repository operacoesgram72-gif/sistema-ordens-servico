---
name: Supabase DB connection & migration quirks
description: How to connect to and run schema migrations against this project's Supabase-backed Postgres DB
---

## Connection
`DATABASE_URL` secret must point at the pooler URL. The direct host is IPv6-only and fails with `EAFNOSUPPORT` inside this container.

## Schema changes
`drizzle-kit push` needs a TTY and won't work here. Instead, add idempotent raw SQL (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, guarded `INSERT ... WHERE NOT EXISTS`) to `scripts/migrate.mjs` and run `node scripts/migrate.mjs` directly (no `--env-file` needed; secrets are already in the environment). The script is safe to re-run.

**Why:** established pattern for this repo; confirmed idempotent by running it twice.

## Avoid `DO $$ ... $$` blocks in migrate.mjs
A `DO $$ BEGIN ... END $$;` conditional block written as a JS template literal in the `migrations` array had one of its `$$` silently collapse to a single `$` before reaching Postgres, causing a syntax error every time. Root cause wasn't fully diagnosed (possibly the Edit tool or JS template literal handling of repeated `$`).

**How to apply:** for conditional DDL (e.g. "add this FK constraint only if it doesn't exist yet"), avoid dollar-quoted `DO` blocks in `scripts/migrate.mjs`. Prefer two idempotent statements instead, e.g.:
```
ALTER TABLE t DROP CONSTRAINT IF EXISTS t_x_fkey;
ALTER TABLE t ADD CONSTRAINT t_x_fkey FOREIGN KEY (x) REFERENCES t(id) ON DELETE SET NULL;
```
This is idempotent (drop-if-exists then add) and avoids the dollar-quoting issue entirely.
