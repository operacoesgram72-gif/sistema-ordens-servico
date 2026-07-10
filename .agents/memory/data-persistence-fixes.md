---
name: Data persistence root causes fixed
description: Documents the silent-write bypass pattern, PMOC persistence fix, auto-migration startup, and Express router path rules
---

## Express router path prefix rule
`app.ts` mounts the main router at `/api`: `app.use("/api", router)`.
Routes defined inside that router must be **relative** — `/pmoc/:storageKey` not `/api/pmoc/:storageKey`.
Getting this wrong causes a double-prefix (`/api/api/...`) that silently 404s every call.

**Why:** Caught in code review after pmoc.ts was written with absolute paths.
**How to apply:** Every new route file added to `routes/index.ts` must use relative paths (no `/api` prefix).

## supabase.ts bypass anti-pattern
The file `artifacts/os-civil/src/lib/supabase.ts` used to bypass the Express API and write directly to Supabase REST.
It had a silent early-return guard `if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return` — when env vars are unset, ALL writes were dropped silently.
One function (`salvarArquivo`) targeted the wrong table (`uploaded_files` vs real `file_entries`).
The file is now emptied (`export {}`) — all data persistence must go through the Express API.

**Why:** VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set in this environment; the bypass was purely dead/broken code.
**How to apply:** Never add new exports to supabase.ts. Use the generated API client hooks or direct fetch to the Express API.

## PMOC offline-first persistence pattern
PMOC uses localStorage as a fast render cache + background PUT to `/api/pmoc/:storageKey`.
On mount, a GET fetches the authoritative server state:
- 404 → key not saved yet; keep localStorage / defaultRows (first-time use)
- 200 → overwrite state AND localStorage (server wins, even if rows is empty array)
- Network error → keep local data silently

storageKey values are validated server-side against `/^pmoc_(main|state_[a-z]+)$/` to prevent arbitrary namespace access.

**Why:** Pure localStorage was lost on browser clear / new device / new deploy. Supabase bypass was silently failing.
**How to apply:** Any future localStorage-backed data store should follow this same pattern.

## Auto-migration on API server startup
`artifacts/api-server/src/index.ts` now runs `node scripts/migrate.mjs` as a subprocess via `execFile` before `app.listen`.
Failures are logged as errors but do not crash the server (all migrations are idempotent `IF NOT EXISTS` / `IF EXISTS`).
This ensures schema changes reach production automatically on every deploy without manual intervention.

**Why:** Previously migrations were manual-only; production was missing tables/indexes until a developer remembered to run the script.
**How to apply:** All schema changes go into `scripts/migrate.mjs` as idempotent SQL — they will auto-apply on next deploy.
