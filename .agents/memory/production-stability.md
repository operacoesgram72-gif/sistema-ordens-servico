---
name: Production 502/503 root causes
description: Root causes of Render/production 502/503 errors and the fixes applied
---

## Migration script path (__dirname, not process.cwd)
`process.cwd()` in production (Render) is the **project root** — NOT `artifacts/api-server/`.
The esbuild banner sets `__dirname` to the directory of the bundled file (`artifacts/api-server/dist/`).

To reach `scripts/migrate.mjs` at project root from `dist/`:
```js
resolve(__dirname, "../../../scripts/migrate.mjs")
// dist/ → api-server/ → artifacts/ → project-root/
```

**Why:** Three levels up from `dist/`, not two. The audit initially said two levels which was wrong.
**How to apply:** Always use `__dirname` (from esbuild banner) for paths relative to the bundle, never `process.cwd()`.

## Express 5 wildcard route syntax
Express 5 (path-to-regexp v8) does NOT accept bare `"*"` as a route pattern.
Use `"/{*path}"` instead:
```js
app.options("/{*path}", handler);  // ✓ Express 5
app.options("*", handler);         // ✗ PathError crash
```

**Why:** Causes a startup crash with `PathError: Missing parameter name at index 1: *`.
**How to apply:** Any wildcard route in Express 5 must use `/{*name}` syntax.

## DB pool configuration
Always set these on `pg.Pool` to prevent hanging connections in production:
```js
{ max: 10, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000, ssl: { rejectUnauthorized: false } }
```

**Why:** Default pool has no timeout — a single unreachable DB causes all requests to hang.

## Global error handlers prevent silent crashes
```js
process.on("unhandledRejection", (reason) => logger.error(reason));
process.on("uncaughtException", (err) => logger.error(err));
```
Also add Express 4-arg error middleware LAST:
```js
app.use((err, req, res, next) => { res.status(500).json(...); });
```

**Why:** Without these, async errors in Express 5 crash the process with no log.

## AbortSignal.timeout browser compatibility
`AbortSignal.timeout(ms)` is not available in all browsers and Android webviews.
Always use a manual fallback:
```js
const controller = new AbortController();
const tid = setTimeout(() => controller.abort(), TIMEOUT_MS);
try { await fetch(url, { signal: controller.signal }); } finally { clearTimeout(tid); }
```

**Why:** Direct `AbortSignal.timeout()` causes all queue items to fail immediately on unsupported environments.

## Health check should probe DB
Return `{ db: "connected" }` or `{ db: "degraded" }` from the health endpoint but always 200.
503 from health endpoints causes Render to restart the process, worsening the problem.
