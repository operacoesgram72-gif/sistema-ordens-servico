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
 *
 * Cross-tab sync: a `storage` event listener keeps pendingCount in sync
 * across all tabs open simultaneously (task #8).
 *
 * Re-submission prevention: successfully-sent item IDs are persisted to
 * localStorage so a page reload mid-drain does not re-submit them (task #9).
 *
 * Per-item timeout: each fetch uses AbortSignal.timeout so a hanging request
 * does not block the entire drain indefinitely (task #10).
 *
 * Storage-full guard: writeQueue failures during drain are handled explicitly
 * and surfaced to the user rather than silently dropped (task #11).
 */
import { useState, useEffect, useRef } from "react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useToast } from "@/hooks/use-toast";
import {
  readQueue,
  writeQueue,
  enqueueOffline,
  enqueueOfflineBatch,
  readSentIds,
  markSent,
  clearSentIds,
  QUEUE_KEY,
} from "@/lib/offline-queue-storage";
import type { QueueItem } from "@/lib/offline-queue-storage";

// Re-export the pure helpers so existing callers keep working unchanged.
export { enqueueOffline, enqueueOfflineBatch } from "@/lib/offline-queue-storage";
export type { QueueItem } from "@/lib/offline-queue-storage";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const MAX_DRAIN_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 2_000; // 2 s → 4 s → 8 s
/** Per-request timeout — prevents a single hanging fetch from blocking the drain. */
const ITEM_FETCH_TIMEOUT_MS = 15_000;

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

  // ── Task #9: clean up items that were successfully sent before a reload ──
  // If the page reloaded while a drain was in progress, some items may have
  // been sent but not yet removed from the queue. Clear them now.
  const sentIds = readSentIds();
  if (sentIds.size > 0) {
    const cleaned = readQueue().filter(i => !sentIds.has(i.id));
    writeQueue(cleaned);
    clearSentIds();
  }

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
          // ── Task #10: per-item timeout so a broken connection can't freeze the drain ──
          const res = await fetch(`${BASE_URL}${item.endpoint}`, {
            method: item.method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.body),
            signal: AbortSignal.timeout(ITEM_FETCH_TIMEOUT_MS),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          // ── Task #9: persist successful send so a reload won't re-submit ──
          markSent(item.id);
        } catch {
          failedItems.push(item);
        }
      }

      if (!callbacks.activeRef.current) return;

      // Safe merge: preserve items enqueued DURING the drain pass.
      const currentQueue = readQueue();
      const newItems = currentQueue.filter(i => !processingIds.has(i.id));
      const merged = [...newItems, ...failedItems];

      // ── Task #11: detect storage-full on queue rewrite ──
      const written = writeQueue(merged);
      if (!written && failedItems.length > 0) {
        // Can't persist the failed items — warn the user so they know data
        // may not be retried automatically on next session.
        callbacks.toast({
          title: "Armazenamento cheio",
          description: `${failedItems.length} item${failedItems.length !== 1 ? "s" : ""} não pôde${failedItems.length !== 1 ? "ram" : ""} ser salvo${failedItems.length !== 1 ? "s" : ""} localmente. Libere espaço no navegador ou sincronize agora.`,
          variant: "destructive",
        });
      }

      // Sent IDs are no longer needed — queue is canonical again.
      clearSentIds();

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
 * - Keeps `pendingCount` in sync across all open tabs via the `storage` event.
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

  // ── Task #8: cross-tab sync via storage event ──────────────────────────────
  // When another tab modifies the queue, refresh our count.
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === QUEUE_KEY) {
        setPendingCount(readQueue().length);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

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
