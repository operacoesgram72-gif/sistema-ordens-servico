/**
 * useStatusEvents — subscribes to the API's SSE stream and calls back
 * whenever another client changes a service order's status.
 *
 * The hook reconnects automatically with exponential back-off when the
 * connection drops (network glitch, server restart, etc.).
 *
 * Returns `{ isConnected }` so consumers can surface a live-stream indicator
 * in the UI (task #18).
 */
import { useEffect, useRef, useState } from "react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface StatusChangedEvent {
  type: "status-changed";
  id: number;
  number: string;
  title: string;
  status: string;
  unidade: string;
  updatedAt: string;
}

type StatusChangedCallback = (event: StatusChangedEvent) => void;

/**
 * Subscribe to real-time status-change events from the server.
 *
 * @param onStatusChanged - Called whenever a service order status changes.
 *   Stable reference recommended (wrap in useCallback) to avoid reconnects.
 * @returns `{ isConnected }` — true when the SSE stream is open and healthy.
 */
export function useStatusEvents(onStatusChanged: StatusChangedCallback): { isConnected: boolean } {
  const callbackRef = useRef(onStatusChanged);
  const [isConnected, setIsConnected] = useState(false);

  // Keep ref current without restarting the SSE connection on every render.
  useEffect(() => {
    callbackRef.current = onStatusChanged;
  });

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 1_000; // ms, doubles on each failure up to 30 s
    let destroyed = false;

    function connect() {
      if (destroyed) return;

      es = new EventSource(`${BASE_URL}/api/events`);

      es.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data) as StatusChangedEvent;
          if (parsed.type === "status-changed") {
            callbackRef.current(parsed);
          }
        } catch {
          // ignore malformed messages
        }
      };

      es.onerror = () => {
        setIsConnected(false);
        es?.close();
        es = null;
        if (destroyed) return;
        // Exponential back-off reconnect
        retryTimer = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 30_000);
          connect();
        }, retryDelay);
      };

      es.onopen = () => {
        // Reset back-off on successful open
        retryDelay = 1_000;
        setIsConnected(true);
      };
    }

    connect();

    return () => {
      destroyed = true;
      setIsConnected(false);
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, []); // intentionally empty — connection is managed manually

  return { isConnected };
}
