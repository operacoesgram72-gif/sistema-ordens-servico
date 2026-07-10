---
name: Performance indexes and query patterns
description: Key decisions made during full-stack performance optimisation — DB indexes, backend query consolidation, frontend React Query patterns
---

## DB indexes (scripts/migrate.mjs)
All 13 indexes are `CREATE INDEX IF NOT EXISTS` idempotent statements added at the bottom of migrate.mjs. Covers:
- `service_orders`: composite (unidade+created_at DESC), (unidade+status), plus individual status, created_at, technician_id, scheduled_at
- `file_entries`: parent_id, unidade
- `technicians`: manager_id, unidade
- `material_withdrawals`: unidade, created_at DESC

**Why:** These were full-table scans on every request. Composite indexes first because most queries filter by both unidade and a second column.

## dashboard.ts — single-pass aggregations

`/summary`: 10 sequential queries → `COUNT(*) FILTER (WHERE ...)` single scan + 2 parallel `GROUP BY` queries (3 total via `Promise.all`).

`/stats`: 4×N loop → single `date_trunc(period, created_at) GROUP BY` + in-memory gap fill for zero-count periods. Both `/summary` and `/stats` accept `unidade` query param (critical: must be consistent so summary cards and chart show the same unit's data).

`/indicators`: separate full technicians table fetch → `LEFT JOIN technicians ON technician_id` in the main query.

**Why:** `/stats` originally ran up to 48 round-trips (4 queries × 12 months). Aggregation in SQL is always faster than N fetches.

## service-orders.ts — enrichWithTechnician
Old: `db.select().from(techniciansTable)` — fetches ALL technicians regardless of how many are referenced.
New: collect unique technician IDs from the orders list → `WHERE id = ANY(...)` via `inArray`. For a list of 50 orders with 5 unique technicians, only 5 rows are fetched.

**Why:** Full table scans on a growing technicians table add latency proportional to total technician count, not the number referenced.

## Frontend React Query patterns

- Global `staleTime: 5 min`, `gcTime: 15 min`, `refetchOnReconnect: true` in App.tsx QueryClient.
- Static/slow-changing data (available-years): `staleTime: 5 min` via `useQuery`.
- File entries: `staleTime: 30 s`; links: `staleTime: 60 s`.
- All queryKeys that feed into `useCallback` deps are wrapped in `useMemo` to prevent spurious re-creations.
- Never use `JSON.stringify(queryKey)` in useCallback deps — use `useMemo`-stabilised key arrays instead.
- `arquivos.tsx` uses `useEffect` watching `error` from `useQuery` to fire toast on failures (React Query v5 removed `onError` from query options).

## Consistency rule
`/dashboard/stats` and `/dashboard/summary` MUST both accept and apply the same `unidade` filter. If you add a new unit-scoped summary endpoint, always check that its paired chart/stats endpoint also accepts `unidade`.
