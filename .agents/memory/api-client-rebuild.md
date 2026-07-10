---
name: lib package TypeScript rebuild requirement
description: All lib/ packages with composite:true tsconfig must have their dist/ rebuilt after src/ edits or consumers see stale/missing types.
---

## Rule
Any edit to `lib/*/src/` must be followed by a `tsc --build` on that package before running downstream typechecks. Affected packages:

| Package | Build command |
|---|---|
| `@workspace/api-client-react` | `pnpm --filter @workspace/api-client-react exec tsc --build` |
| `@workspace/api-zod` | `pnpm --filter @workspace/api-zod exec tsc --build` |
| `@workspace/db` | `pnpm --filter @workspace/db exec tsc --build` |

**Why:** Artifacts (`os-civil`, `api-server`) use TypeScript project references (`tsconfig.json → "references": [...]`). TS resolves types from `dist/` — the compiled output — not from `src/` directly, even though `package.json#exports` points at `./src/index.ts` for bundler resolution. When `dist/` is stale (e.g. a column added to the DB schema, or a new field added to a Zod schema), consumers typecheck against the old declarations and report spurious "property does not exist" / "no exported member" errors.

**How to apply:** Before running `tsc --noEmit` on any artifact, check whether you edited anything under `lib/`. If yes, rebuild the relevant lib package(s) first. Errors like "Property 'X' does not exist" or "Module has no exported member 'Y'" in a lib consumer are the tell-tale sign of a stale dist.
