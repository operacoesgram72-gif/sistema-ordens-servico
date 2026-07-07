---
name: api-client-react TypeScript rebuild requirement
description: After editing lib/api-client-react/src/, the dist/ .d.ts files must be regenerated or consumers won't see new exports.
---

## Rule
After any edit to `lib/api-client-react/src/` (adding exports, changing hook signatures, etc.), run:

```
pnpm --filter @workspace/api-client-react exec tsc --build
```

This regenerates `dist/*.d.ts` and `dist/generated/api.d.ts` that consumers like `artifacts/os-civil` use via TypeScript project references.

**Why:** `os-civil/tsconfig.json` uses `"references": [{"path": "../../lib/api-client-react"}]` which means TypeScript resolves types from `dist/` (the compiled output), not from `src/` directly — even though `package.json` exports `"./src/index.ts"` for bundler resolution. The incremental `.tsbuildinfo` cache can mask this; deleting it does not help if `dist/*.d.ts` are stale.

**How to apply:** Anytime you add a new export to `custom-fetch.ts`, `index.ts`, or regenerate `generated/api.ts`, run the build command above before running `tsc --noEmit` on `os-civil`.
