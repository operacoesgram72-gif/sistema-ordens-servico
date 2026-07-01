---
name: Supabase DB connection via env vars
description: How the API server connects to Supabase — secrets are NOT auto-injected into Replit workflows, so DATABASE_URL can't be a secret.
---

# Supabase DB Connection — GRAM Operações

## The rule

Replit **secrets** are NOT automatically injected into workflow processes. Only **env vars** (set via `setEnvVars`) are available in workflows. `DATABASE_URL` and all `PG*` vars are secrets → they arrive as empty strings in the workflow process.

## How to apply

`lib/db/src/index.ts` builds the connection string at runtime:
1. Tries `process.env.DATABASE_URL` first (works if moved from secret to env var)
2. Falls back to: `PGHOST` (or derived from `VITE_SUPABASE_URL` project ref → `db.<ref>.supabase.co`) + `PGUSER` (default `postgres`) + `SUPABASE_DB_PASSWORD` (shared env var) + `PGDATABASE` (default `postgres`) + `PGPORT` (default `5432`)
3. Always sets `ssl: { rejectUnauthorized: false }` in the Pool config

## Working config (as of July 2026)

- `VITE_SUPABASE_URL` = `https://ubxwxjruivuvjednkctd.supabase.co` (env var, shared)
- `VITE_SUPABASE_ANON_KEY` = publishable key (env var, shared)  
- `SUPABASE_DB_PASSWORD` = Supabase DB password (env var, shared) — set by user
- Supabase project ref: `ubxwxjruivuvjednkctd`
- DB host: `db.ubxwxjruivuvjednkctd.supabase.co`

**Why:** The artifact.toml originally tried to construct DATABASE_URL from PG* vars in the run command, but those PG* vars are secrets and arrive empty. The fix was to use SUPABASE_DB_PASSWORD as a regular env var and derive the host from the already-available VITE_SUPABASE_URL.
