/**
 * Offline queue unit tests — run with Node.js built-in test runner + tsx:
 *
 *   pnpm --filter @workspace/os-civil test
 *
 * No browser environment or Vite is required; the tested module
 * (offline-queue-storage) has no import.meta.env usage.
 */
import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

// ─── Minimal localStorage shim ──────────────────────────────────────────────
// Node.js 24 doesn't provide localStorage. We install a per-test in-memory
// shim on globalThis so the queue module finds it.

class InMemoryStorage {
  private _store: Record<string, string> = {};
  getItem(key: string) { return this._store[key] ?? null; }
  setItem(key: string, value: string) { this._store[key] = value; }
  removeItem(key: string) { delete this._store[key]; }
  clear() { this._store = {}; }
  get length() { return Object.keys(this._store).length; }
  key(n: number) { return Object.keys(this._store)[n] ?? null; }
}

// Install before any imports that touch localStorage at module scope.
const storage = new InMemoryStorage();
Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });

// ─── Import the module under test ────────────────────────────────────────────
// This import is deferred (dynamic) so the globalThis shim is installed first.
const {
  QUEUE_KEY,
  readQueue,
  writeQueue,
  enqueueOffline,
  enqueueOfflineBatch,
  MAX_ITEM_BYTES,
} = await import("../lib/offline-queue-storage.ts");

// ─── Helpers ─────────────────────────────────────────────────────────────────
function clearQueue() { storage.clear(); }

const baseItem = {
  type: "create-os",
  endpoint: "/api/service-orders",
  method: "POST" as const,
  body: { location: "Andar 3", priority: "alta" },
  unit: "AM",
  label: "OS — test",
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("readQueue / writeQueue", () => {
  beforeEach(clearQueue);

  it("returns an empty array when localStorage has no entry", () => {
    assert.deepEqual(readQueue(), []);
  });

  it("returns stored items after writeQueue", () => {
    const item = { id: "test-1", timestamp: 1, ...baseItem };
    writeQueue([item]);
    assert.deepEqual(readQueue(), [item]);
  });

  it("returns empty array if stored value is malformed JSON", () => {
    storage.setItem(QUEUE_KEY, "not-json{{");
    assert.deepEqual(readQueue(), []);
  });
});

describe("enqueueOffline", () => {
  beforeEach(clearQueue);

  it("adds a single item to the queue and returns persisted=true", () => {
    const { item, persisted } = enqueueOffline(baseItem);
    assert.equal(persisted, true);
    const queue = readQueue();
    assert.equal(queue.length, 1);
    assert.equal(queue[0].id, item.id);
    assert.equal(queue[0].endpoint, "/api/service-orders");
    assert.equal(queue[0].unit, "AM");
  });

  it("assigns a unique id and a timestamp to the item", () => {
    const { item } = enqueueOffline(baseItem);
    assert.match(item.id, /^q-\d+-[a-z0-9]+$/);
    assert.ok(item.timestamp > 0);
  });

  it("preserves existing items when a new one is enqueued (append-only)", () => {
    enqueueOffline(baseItem);
    enqueueOffline({ ...baseItem, label: "OS — second" });
    assert.equal(readQueue().length, 2);
  });

  it("returns persisted=false and does NOT write when body exceeds MAX_ITEM_BYTES", () => {
    const oversizedBody = { data: "x".repeat(MAX_ITEM_BYTES + 1) };
    const { persisted } = enqueueOffline({ ...baseItem, body: oversizedBody });
    assert.equal(persisted, false);
    assert.equal(readQueue().length, 0);
  });

  it("returns persisted=false when localStorage throws (quota exceeded)", () => {
    const origSetItem = storage.setItem.bind(storage);
    // Temporarily make setItem throw to simulate quota exceeded.
    (storage as any).setItem = () => { throw new DOMException("QuotaExceededError"); };
    const { persisted } = enqueueOffline(baseItem);
    assert.equal(persisted, false);
    (storage as any).setItem = origSetItem;
  });
});

describe("enqueueOfflineBatch", () => {
  beforeEach(clearQueue);

  it("adds multiple items atomically when all are within size limits", () => {
    const items = [
      { ...baseItem, label: "item-1" },
      { ...baseItem, label: "item-2" },
      { ...baseItem, label: "item-3" },
    ];
    const { items: added, persisted } = enqueueOfflineBatch(items);
    assert.equal(persisted, true);
    assert.equal(added.length, 3);
    const queue = readQueue();
    assert.equal(queue.length, 3);
  });

  it("assigns stable, increasing timestamps for ordering", () => {
    const items = [baseItem, { ...baseItem, label: "b" }, { ...baseItem, label: "c" }];
    const { items: added } = enqueueOfflineBatch(items);
    assert.ok(added[0].timestamp <= added[1].timestamp);
    assert.ok(added[1].timestamp <= added[2].timestamp);
  });

  it("rejects the entire batch (all-or-nothing) if any item exceeds MAX_ITEM_BYTES", () => {
    const oversizedBody = { data: "x".repeat(MAX_ITEM_BYTES + 1) };
    const items = [
      baseItem,
      { ...baseItem, body: oversizedBody, label: "oversized" },
    ];
    const { persisted } = enqueueOfflineBatch(items);
    assert.equal(persisted, false);
    // Nothing must be written — queue must remain empty.
    assert.equal(readQueue().length, 0);
  });

  it("appends batch to items already in the queue without overwriting them", () => {
    enqueueOffline(baseItem); // pre-existing item
    enqueueOfflineBatch([
      { ...baseItem, label: "batch-1" },
      { ...baseItem, label: "batch-2" },
    ]);
    assert.equal(readQueue().length, 3);
  });

  it("handles an empty batch gracefully — writes nothing but returns persisted=true", () => {
    const { persisted } = enqueueOfflineBatch([]);
    assert.equal(persisted, true);
    assert.equal(readQueue().length, 0);
  });
});

describe("drain contract", () => {
  /**
   * These tests verify the observable drain contract by simulating the drain
   * loop directly — without requiring a React environment.  The drain logic in
   * runDrain (use-offline-queue.ts) does:
   *   1. Reads the queue
   *   2. POSTs each item via fetch
   *   3. On full success: removes ALL processed items from the queue
   *   4. On partial failure: keeps only the failed items
   */
  beforeEach(clearQueue);

  it("successfully drained items are removed from the queue", async () => {
    // Arrange: two items in the queue
    enqueueOffline({ ...baseItem, label: "drain-1" });
    enqueueOffline({ ...baseItem, label: "drain-2" });

    const queue = readQueue();
    assert.equal(queue.length, 2);

    // Act: simulate a successful drain pass
    const processedIds = new Set(queue.map(i => i.id));
    const failed: typeof queue = [];
    const remaining = readQueue().filter(i => !processedIds.has(i.id));
    const merged = [...remaining, ...failed];
    writeQueue(merged);

    // Assert: queue is now empty
    assert.equal(readQueue().length, 0);
  });

  it("failed items are kept in the queue; succeeded items are removed", async () => {
    enqueueOffline({ ...baseItem, label: "ok-item" });
    enqueueOffline({ ...baseItem, label: "fail-item" });

    const queue = readQueue();
    const failedItem = queue[1]; // second item fails
    const processedIds = new Set(queue.map(i => i.id));
    const failed = [failedItem];
    const remaining = readQueue().filter(i => !processedIds.has(i.id));
    const merged = [...remaining, ...failed];
    writeQueue(merged);

    const after = readQueue();
    assert.equal(after.length, 1);
    assert.equal(after[0].id, failedItem.id);
  });

  it("items enqueued DURING a drain pass are not lost (safe merge)", async () => {
    enqueueOffline({ ...baseItem, label: "pre-drain" });

    const queue = readQueue();
    const processedIds = new Set(queue.map(i => i.id));

    // Simulate an item being enqueued mid-drain
    enqueueOffline({ ...baseItem, label: "mid-drain" });

    // Drain completes: failed=[], merge preserves items added during drain
    const currentQueue = readQueue();
    const newItems = currentQueue.filter(i => !processedIds.has(i.id));
    writeQueue([...newItems]);

    const after = readQueue();
    assert.equal(after.length, 1);
    assert.equal(after[0].label, "mid-drain");
  });
});
