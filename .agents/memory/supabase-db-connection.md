---
name: Supabase DB Connection
description: How the Supabase database connection is configured and the quirks discovered in this Replit environment.
---

## Rules

- **Always rely on `DATABASE_URL` secret** — the user sets it in Replit Secrets with the full Supabase connection string (pooler or direct). The code checks it first.
- `??` does NOT catch empty strings (`""`). Use `||` when env vars can be set-but-empty (PGHOST, PGPORT, etc. from Replit's managed secrets are defined but empty in this project).
- The Supabase direct DB host (`db.<ref>.supabase.co`) is **IPv6-only** in this project's region. IPv6 TCP connections are **not supported** in this Replit container (`EAFNOSUPPORT`). **Do not try to connect to the direct host.**
- The Supabase session pooler (`aws-0-*.pooler.supabase.com`) can be reached over IPv4, but the project's region must match — wrong region gives `tenant/user not found`.
- The current `lib/db/src/index.ts` uses **top-level await** (valid in ESM `.mjs` output) to build the pool. Priority: `DATABASE_URL` → direct host (if IPv4) → pooler discovery → PG* vars.

**Why:** the Supabase direct DB resolved to IPv6 only and `connect EAFNOSUPPORT` was the error. The pool must connect via IPv4 (pooler) or a full `DATABASE_URL` that points to the pooler.

**How to apply:** When the API server fails with `EAFNOSUPPORT` or `getaddrinfo ENOTFOUND`, check that `DATABASE_URL` secret has a valid pooler connection string from the Supabase dashboard (Settings → Database → Connection string → Session/Transaction pooler).

## Schema migrations

- `drizzle-kit push` needs a TTY and fails in this environment.
- Run migrations as raw SQL via `node scripts/migrate.mjs` (uses `DATABASE_URL` from env).
- The script uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS` — safe to re-run.
- Always add new columns/tables to both the Drizzle schema files AND `scripts/migrate.mjs`.

## Current working db/index.ts approach

Uses top-level await (ESM) to:
1. Check `DATABASE_URL` (non-empty) → use it directly
2. Try direct host for IPv4 → skip if IPv6-only  
3. Discover pooler by trying common regions with `dns.promises.resolve4`
4. Fall back to PG* env vars
