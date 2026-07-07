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
import {
  readQueue,
  writeQueue,
  enqueueOffline,
  enqueueOfflineBatch,
} from "@/lib/offline-queue-storage";
import type { QueueItem } from "@/lib/offline-queue-storage";

// Re-export the pure helpers so existing callers keep working unchanged.
export { enqueueOffline, enqueueOfflineBatch } from "@/lib/offline-queue-storage";
export type { QueueItem } from "@/lib/offline-queue-storage";

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
