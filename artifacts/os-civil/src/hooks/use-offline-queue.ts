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

function writeQueue(items: QueueItem[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Add an item to the offline queue (without React state — safe to call outside components).
 */
export function enqueueOffline(item: Omit<QueueItem, "id" | "timestamp">): QueueItem {
  const fullItem: QueueItem = {
    ...item,
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };
  writeQueue([...readQueue(), fullItem]);
  return fullItem;
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

  const enqueue = (item: Omit<QueueItem, "id" | "timestamp">): void => {
    const fullItem = enqueueOffline(item);
    setPendingCount(readQueue().length);
    // Supress unused var warning — fullItem returned for caller use if needed
    void fullItem;
  };

  return { isOnline, pendingCount, enqueue };
}
