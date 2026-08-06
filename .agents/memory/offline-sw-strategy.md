---
name: Offline SW + network-error queue fallback
description: Service worker caching strategy and how form mutations handle the "online but unreachable" mobile scenario
---

## Service Worker (public/sw.js) — v3

**Why the old v2 SW broke offline in dev mode:**  
Vite dev mode serves JS at `/src/...?t=<timestamp>` (not `/assets/`). The v2 cache-first rule only matched `/assets/`, so dev-mode JS was never cached. Going offline after first visit would fail because the browser couldn't load the JS bundles.

**v3 fix — stale-while-revalidate with ignoreSearch:true:**
- `/api/*` → network-only (never cached)
- `mode === "navigate"` (HTML) → network-first, fallback to cached `/` (SPA shell)
- Everything else → stale-while-revalidate; `ignoreSearch: true` so Vite timestamps don't bust the cache

**Why ignoreSearch matters:**  
`/src/main.tsx?t=111` and `/src/main.tsx?t=222` are treated as the same resource. Cached on first online visit, served from cache offline regardless of timestamp change.

**Precache expanded** to include `/registrar` and `/fechar-os` so employee portal routes are warm from install.

## Network-error → queue fallback (registrar-os + fechar-os)

`navigator.onLine` can be `true` on mobile when the server is actually unreachable (weak LTE, captive portal, WiFi without internet). Previously:
- `createOrder.mutate` onError → only showed error toast, form data LOST
- `handleSaveEdit` → no offline check, only error toast
- `handleStatusChange` online catch → reverted optimistic update, data lost

**Detection pattern:**
```ts
const isNetErr = error instanceof TypeError && /fetch|network|failed|load/i.test(error.message);
```

**Fixes applied:**
- `registrar-os.tsx` `onError`: if `isNetErr`, queue the payload and show deferred-success UI
- `fechar-os.tsx` `handleSaveEdit`: explicit `if (!isOnline)` path + `isNetErr` catch fallback
- `fechar-os.tsx` `handleStatusChange` catch: if `isNetErr`, queue and keep optimistic update; else revert

**How to apply:**  
Any new fetch in employee portal pages (fechar-os, registrar-os, registrar-materiais) that is user-triggered and modifies server state should follow this same pattern: explicit `!isOnline` first, then `isNetErr` catch fallback.
