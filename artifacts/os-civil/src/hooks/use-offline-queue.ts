/**
 * useOfflineQueue — localStorage-based offline queue for employee registration screens.
 *
 * Stores form submissions when the device is offline and automatically drains
 * (sends) them when the connection is restored. Works without a service worker.
 */
import { useState, useEffect } from "react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useToast } from "@/hooks/use-toast";

const QUEUE_KEY = "gram-offline-queue";
const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Module-level drain guard — prevents concurrent drains from multiple hook
 * instances or rapid connectivity flaps causing duplicate submissions.
 */
let isDraining = false;

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

function readQueue(): QueueItem[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

/** Estimated size in bytes of a value after JSON serialisation. */
function roughByteSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/**
 * Maximum bytes a single queued item body is allowed to occupy.
 * 512 KB is well below the typical 5 MB localStorage quota and leaves
 * room for the rest of the queue.
 */
const MAX_ITEM_BYTES = 512 * 1024;

/**
 * Write queue to localStorage.
 * @returns `true` when persisted, `false` when a storage error occurred.
 */
function writeQueue(items: QueueItem[]): boolean {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

/**
 * Add an item to the offline queue (without React state — safe to call outside components).
 *
 * @returns `{ item, persisted }` — callers MUST check `persisted` and surface
 *   a destructive toast when it is `false` (storage quota exceeded or unavailable).
 */
export function enqueueOffline(item: Omit<QueueItem, "id" | "timestamp">): { item: QueueItem; persisted: boolean } {
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

/**
 * React hook that:
 * - Exposes `isOnline`, `pendingCount`, and `enqueue`.
 * - Automatically drains the queue when connectivity is restored.
 * - Shows a toast for each batch of successfully synced items.
 */
export function useOfflineQueue() {
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const [pendingCount, setPendingCount] = useState(() => readQueue().length);

  // Drain queue when back online — single-flight guard prevents duplicate drains
  useEffect(() => {
    if (!isOnline) return;
    if (isDraining) return;
    const queue = readQueue();
    if (queue.length === 0) return;

    isDraining = true;
    // Record the IDs being processed in this drain run
    const processingIds = new Set(queue.map(i => i.id));
    let active = true;

    (async () => {
      try {
        const failedItems: QueueItem[] = [];

        for (const item of queue) {
          try {
            const res = await fetch(`${BASE_URL}${item.endpoint}`, {
              method: item.method,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(item.body),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
          } catch {
            failedItems.push(item);
          }
        }

        if (!active) return;

        // Safe merge: re-read current queue to preserve items enqueued DURING drain,
        // then keep new items + failed items (don't overwrite with just failed[]).
        const currentQueue = readQueue();
        const newItems = currentQueue.filter(i => !processingIds.has(i.id));
        const merged = [...newItems, ...failedItems];
        writeQueue(merged);
        setPendingCount(merged.length);

        const sent = queue.length - failedItems.length;
        if (sent > 0) {
          toast({
            title: `${sent} registro${sent !== 1 ? "s" : ""} sincronizado${sent !== 1 ? "s" : ""}! ✓`,
            description: `Dados enviados ao servidor com sucesso.${failedItems.length > 0 ? ` ${failedItems.length} ainda pendente(s).` : ""}`,
          });
        }
      } finally {
        isDraining = false;
      }
    })();

    return () => {
      active = false;
    };
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Enqueue a single item and update React state.
   * @returns `true` when persisted successfully, `false` on storage failure.
   *   Callers MUST show a destructive toast when this returns `false`.
   */
  const enqueue = (item: Omit<QueueItem, "id" | "timestamp">): boolean => {
    const { persisted } = enqueueOffline(item);
    setPendingCount(readQueue().length);
    return persisted;
  };

  /**
   * Atomically enqueue multiple items and update React state.
   * All-or-nothing: if any item fails validation or the write fails, NOTHING is stored.
   * @returns `true` when all items were persisted, `false` on any failure.
   *   Callers MUST show a destructive toast when this returns `false`.
   */
  const enqueueBatch = (items: Omit<QueueItem, "id" | "timestamp">[]): boolean => {
    const { persisted } = enqueueOfflineBatch(items);
    setPendingCount(readQueue().length);
    return persisted;
  };

  return { isOnline, pendingCount, enqueue, enqueueBatch };
}
