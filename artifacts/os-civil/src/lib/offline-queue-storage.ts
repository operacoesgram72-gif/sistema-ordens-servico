/**
 * offline-queue-storage — pure localStorage helpers for the offline queue.
 *
 * Kept separate from the React hook so this logic can be imported and tested
 * in Node.js environments without Vite / import.meta.env.
 */

export const QUEUE_KEY = "gram-offline-queue";
/** Stores IDs of items that were successfully sent before the queue was written. */
export const SENT_IDS_KEY = "gram-offline-sent-ids";

export interface QueueItem {
  id: string;
  /** Identifier for the type of submission, e.g. "create-os", "create-materiais", "patch-status" */
  type: string;
  /** API endpoint path, e.g. "/api/service-orders" */
  endpoint: string;
  method: "POST" | "PATCH" | "PUT";
  body: Record<string, unknown>;
  /** Regional unit this submission belongs to */
  unit: string;
  /** Unix timestamp when the item was queued */
  timestamp: number;
  /** Human-readable description for sync notifications */
  label: string;
}

export function readQueue(): QueueItem[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

/** Estimated size in bytes of a value after JSON serialisation. */
export function roughByteSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/**
 * Maximum bytes a single queued item body is allowed to occupy.
 * 512 KB is well below the typical 5 MB localStorage quota and leaves
 * room for the rest of the queue.
 */
export const MAX_ITEM_BYTES = 512 * 1024;

/**
 * Write queue to localStorage.
 * @returns `true` when persisted, `false` when a storage error occurred.
 */
export function writeQueue(items: QueueItem[]): boolean {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

/**
/** Read the set of item IDs already sent successfully (persisted across reload). */
export function readSentIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SENT_IDS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Persist one successfully-sent item ID so a reload won't re-submit it. */
export function markSent(id: string): void {
  try {
    const ids = readSentIds();
    ids.add(id);
    localStorage.setItem(SENT_IDS_KEY, JSON.stringify([...ids]));
  } catch {
    // quota exceeded — best effort; item may be re-sent after a reload
  }
}

/** Clear all tracked sent IDs (called after the queue is cleanly rewritten). */
export function clearSentIds(): void {
  try {
    localStorage.removeItem(SENT_IDS_KEY);
  } catch {}
}

/**
 * Add an item to the offline queue (without React state — safe to call outside components).
 *
 * @returns `{ item, persisted }` — callers MUST check `persisted` and surface
 *   a destructive toast when it is `false` (storage quota exceeded or unavailable).
 */
export function enqueueOffline(
  item: Omit<QueueItem, "id" | "timestamp">
): { item: QueueItem; persisted: boolean } {
  const fullItem: QueueItem = {
    ...item,
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };

  // Guard against very large payloads (e.g. base64 photos) that would bust quota.
  if (roughByteSize(fullItem.body) > MAX_ITEM_BYTES) {
    return { item: fullItem, persisted: false };
  }

  const persisted = writeQueue([...readQueue(), fullItem]);
  return { item: fullItem, persisted };
}

/**
 * Atomically enqueue multiple items.
 *
 * All items are pre-validated and written in a **single** localStorage write so
 * that either all succeed or none are stored — preventing the partial-save state
 * that would cause silent duplicates on retry.
 *
 * @returns `{ items, persisted }` — if `persisted` is `false`, NO items were
 *   written. Callers MUST surface a destructive toast in that case.
 */
export function enqueueOfflineBatch(
  items: Omit<QueueItem, "id" | "timestamp">[]
): { items: QueueItem[]; persisted: boolean } {
  const now = Date.now();
  const fullItems: QueueItem[] = items.map((item, idx) => ({
    ...item,
    id: `q-${now}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now + idx, // ensure stable ordering
  }));

  // Pre-validate every item before touching storage (all-or-nothing)
  for (const fullItem of fullItems) {
    if (roughByteSize(fullItem.body) > MAX_ITEM_BYTES) {
      return { items: fullItems, persisted: false };
    }
  }

  const persisted = writeQueue([...readQueue(), ...fullItems]);
  return { items: fullItems, persisted };
}
