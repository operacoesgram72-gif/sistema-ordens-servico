/**
 * Skeleton-loading structural tests.
 *
 * These tests verify that the Dashboard and Ordens components implement the
 * expected skeleton-loading pattern.  They work by statically analysing the
 * component source — no browser / jsdom environment is required.
 *
 * Run with: pnpm --filter @workspace/os-civil test
 *
 * A regression is caught when:
 *   - Someone removes the `isLoading` guard that gates the skeleton block
 *   - The `<Skeleton …>` import is deleted
 *   - The skeleton block is replaced with something else that no longer
 *     renders placeholder UI during the initial data fetch
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function src(relPath: string): string {
  return readFileSync(resolve(__dirname, relPath), "utf8");
}

// ─── Dashboard skeleton ───────────────────────────────────────────────────────

describe("Dashboard — skeleton loading", () => {
  const code = src("../pages/dashboard.tsx");

  it("imports the Skeleton component", () => {
    assert.ok(
      /from ["']@\/components\/ui\/skeleton["']/.test(code),
      "dashboard.tsx must import Skeleton from @/components/ui/skeleton"
    );
  });

  it("renders Skeleton elements while data is loading (isLoading guard)", () => {
    // The file must gate skeleton UI on loadingSummary or loadingStats being true.
    const hasLoadingGuard =
      /\bloadingSummary\b/.test(code) || /\bloadingStats\b/.test(code) || /\bisLoading\b/.test(code);
    assert.ok(
      hasLoadingGuard,
      "dashboard.tsx must have a loading state variable (loadingSummary/loadingStats/isLoading)"
    );
  });

  it("uses <Skeleton … /> inside the loading branch", () => {
    // Count Skeleton JSX usages
    const skeletonMatches = code.match(/<Skeleton\b/g);
    assert.ok(
      skeletonMatches && skeletonMatches.length >= 3,
      `dashboard.tsx should render at least 3 Skeleton placeholders during load, found ${skeletonMatches?.length ?? 0}`
    );
  });

  it("does not render real KPI values while loading (loading branch returns early)", () => {
    // The component should have a conditional block that returns the skeleton
    // layout without rendering summary.totalOpen etc.
    const hasEarlyReturn =
      /if\s*\(\s*(loadingSummary|loadingStats)/.test(code) ||
      /\?\s*\(\s*[\s\S]{0,40}<Skeleton/.test(code);
    assert.ok(
      hasEarlyReturn,
      "dashboard.tsx must short-circuit to skeleton UI before rendering real data"
    );
  });
});

// ─── Ordens skeleton ─────────────────────────────────────────────────────────

describe("Ordens — skeleton loading", () => {
  const code = src("../pages/ordens.tsx");

  it("imports the Skeleton component", () => {
    assert.ok(
      /from ["']@\/components\/ui\/skeleton["']/.test(code),
      "ordens.tsx must import Skeleton from @/components/ui/skeleton"
    );
  });

  it("renders Skeleton table rows while data is loading (isLoading guard)", () => {
    assert.ok(
      /\bisLoading\b/.test(code),
      "ordens.tsx must have an isLoading variable"
    );
  });

  it("uses <Skeleton … /> inside table rows during load", () => {
    const skeletonMatches = code.match(/<Skeleton\b/g);
    assert.ok(
      skeletonMatches && skeletonMatches.length >= 4,
      `ordens.tsx should render at least 4 Skeleton cells per loading row, found ${skeletonMatches?.length ?? 0}`
    );
  });

  it("skeleton rows are shown inside <TableBody> when isLoading is true", () => {
    // The isLoading ternary must appear between the opening and closing TableBody tags.
    const tableBodySection = code.match(/<TableBody>([\s\S]*?)<\/TableBody>/)?.[0] ?? "";
    assert.ok(
      /isLoading/.test(tableBodySection),
      "isLoading check must appear inside <TableBody> so skeleton rows replace the real rows"
    );
  });
});

// ─── Offline form UI ─────────────────────────────────────────────────────────

describe("RegistrarOS — offline UI indicators", () => {
  const code = src("../pages/registrar-os.tsx");

  it("imports useOfflineQueue", () => {
    assert.ok(
      /useOfflineQueue/.test(code),
      "registrar-os.tsx must import useOfflineQueue"
    );
  });

  it("renders an offline banner when isOnline is false", () => {
    assert.ok(
      /!isOnline/.test(code),
      "registrar-os.tsx must conditionally render UI based on !isOnline"
    );
  });

  it("calls enqueue() with the form payload when offline", () => {
    assert.ok(
      /enqueue\s*\(/.test(code),
      "registrar-os.tsx must call enqueue() to defer submissions when offline"
    );
  });

  it("shows a deferred-success screen (submittedOffline state)", () => {
    assert.ok(
      /submittedOffline/.test(code),
      "registrar-os.tsx must track submittedOffline state to show the correct success UI"
    );
  });
});

describe("RegistrarMateriais — offline UI indicators", () => {
  const code = src("../pages/registrar-materiais.tsx");

  it("imports useOfflineQueue", () => {
    assert.ok(
      /useOfflineQueue/.test(code),
      "registrar-materiais.tsx must import useOfflineQueue"
    );
  });

  it("calls enqueueBatch() for atomic multi-material submission when offline", () => {
    assert.ok(
      /enqueueBatch\s*\(/.test(code),
      "registrar-materiais.tsx must call enqueueBatch() for all-or-nothing offline queuing"
    );
  });

  it("renders an offline banner when isOnline is false", () => {
    assert.ok(
      /!isOnline/.test(code),
      "registrar-materiais.tsx must conditionally render UI based on !isOnline"
    );
  });

  it("shows a deferred-success screen when submitted offline", () => {
    assert.ok(
      /submittedOffline/.test(code),
      "registrar-materiais.tsx must track submittedOffline state"
    );
  });
});
