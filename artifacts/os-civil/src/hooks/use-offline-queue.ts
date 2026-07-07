/**
 * useOfflineQueue — localStorage-based offline queue for employee registration screens.
 *
 * Stores form submissions when the device is offline and automatically drains
 * (sends) them when the connection is restored. Works without a service worker.
 *
 * Drain triggers:
 *  1. `online` event — network reconnects
 *  2. `visibilitychange` — user switches back to this tab
 *  3. Mount — items left from a previous session are sent immediately
 *
 * Each drain run retries failed items up to MAX_DRAIN_RETRIES times with
 * exponential back-off before giving up and surfacing an error toast.
 */
import { useState, useEffect, useRef } from "react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useToast } from "@/hooks/use-toast";

const QUEUE_KEY = "gram-offline-queue";
const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const MAX_DRAIN_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 2_000; // 2 s → 4 s → 8 s

/**
 * Module-level drain guard — prevents concurrent drains from multiple hook
 * instances or rapid connectivity flaps causing duplicate submissions.
 */
let isDraining = false;
/** Tracks how many consecutive failed drain attempts have occurred. */
let drainRetryCount = 0;
/** Handle for a scheduled back-off retry so we can cancel it on unmount. */
let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

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

// ---------------------------------------------------------------------------
// Internal drain engine (called by the hook, not exported)
// ---------------------------------------------------------------------------

interface DrainCallbacks {
  onCountChange: (n: number) => void;
  toast: ReturnType<typeof useToast>["toast"];
  isOnlineRef: React.MutableRefObject<boolean>;
  activeRef: React.MutableRefObject<boolean>;
}

/**
 * Attempt a single drain pass. On partial failure, schedules an exponential
 * back-off retry (up to MAX_DRAIN_RETRIES). After exhausting retries, surfaces
 * an error toast and resets the counter so future triggers can try again.
 */
function runDrain(callbacks: DrainCallbacks) {
  if (isDraining) return;
  if (!callbacks.isOnlineRef.current) return;

  const queue = readQueue();
  if (queue.length === 0) return;

  isDraining = true;
  const processingIds = new Set(queue.map(i => i.id));

  void (async () => {
    try {
      const failedItems: QueueItem[] = [];

      for (const item of queue) {
        if (!callbacks.activeRef.current) break;
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

      if (!callbacks.activeRef.current) return;

      // Safe merge: preserve items enqueued DURING the drain pass.
      const currentQueue = readQueue();
      const newItems = currentQueue.filter(i => !processingIds.has(i.id));
      const merged = [...newItems, ...failedItems];
      writeQueue(merged);
      callbacks.onCountChange(merged.length);

      const sent = queue.length - failedItems.length;
      if (sent > 0) {
        callbacks.toast({
          title: `${sent} registro${sent !== 1 ? "s" : ""} sincronizado${sent !== 1 ? "s" : ""}! ✓`,
          description: `Dados enviados ao servidor com sucesso.${failedItems.length > 0 ? ` ${failedItems.length} ainda pendente(s).` : ""}`,
        });
      }

      if (failedItems.length > 0) {
        drainRetryCount += 1;
        if (drainRetryCount <= MAX_DRAIN_RETRIES) {
          // Schedule back-off retry
          const delay = BASE_RETRY_DELAY_MS * Math.pow(2, drainRetryCount - 1);
          retryTimeoutId = setTimeout(() => {
            retryTimeoutId = null;
            runDrain(callbacks);
          }, delay);
        } else {
          // All retries exhausted — tell the user
          drainRetryCount = 0;
          callbacks.toast({
            title: "Falha ao sincronizar",
            description: `${failedItems.length} item${failedItems.length !== 1 ? "s" : ""} não pôde${failedItems.length !== 1 ? "ram" : ""} ser enviado${failedItems.length !== 1 ? "s" : ""} após ${MAX_DRAIN_RETRIES} tentativas. Será sincronizado automaticamente mais tarde.`,
            variant: "destructive",
          });
        }
      } else {
        // Full success — reset counter
        drainRetryCount = 0;
      }
    } finally {
      isDraining = false;
    }
  })();
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * React hook that:
 * - Exposes `isOnline`, `pendingCount`, and `enqueue` / `enqueueBatch`.
 * - Automatically drains the queue on mount, on `online`, and on `visibilitychange`.
 * - Retries failed drain attempts with exponential back-off (up to 3 times).
 * - Shows a toast for each batch of successfully synced items, and an error
 *   toast when retries are exhausted.
 */
export function useOfflineQueue() {
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const [pendingCount, setPendingCount] = useState(() => readQueue().length);

  // Keep a ref so the async drain can check current online/active state without
  // capturing a stale closure.
  const isOnlineRef = useRef(isOnline);
  const activeRef = useRef(true);
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);

  // Stable callbacks object — rebuilt only when toast identity changes (rare).
  const callbacks: DrainCallbacks = {
    onCountChange: setPendingCount,
    toast,
    isOnlineRef,
    activeRef,
  };

  // ── Drain on `online` event ────────────────────────────────────────────────
  useEffect(() => {
    if (!isOnline) return;
    drainRetryCount = 0; // fresh connection — reset retry counter
    runDrain(callbacks);
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drain on mount (items from a previous session) ────────────────────────
  useEffect(() => {
    activeRef.current = true;
    if (isOnline && readQueue().length > 0) {
      runDrain(callbacks);
    }
    return () => {
      activeRef.current = false;
      // Cancel any pending back-off retry when the last consumer unmounts.
      if (retryTimeoutId !== null) {
        clearTimeout(retryTimeoutId);
        retryTimeoutId = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drain on visibilitychange (tab becomes active) ────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isOnlineRef.current) {
        runDrain(callbacks);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
