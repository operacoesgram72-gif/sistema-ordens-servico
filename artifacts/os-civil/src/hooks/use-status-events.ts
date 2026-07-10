/**
 * useStatusEvents — subscribes to the API's SSE stream and calls back
 * whenever another client changes a service order's status.
 *
 * The hook reconnects automatically with exponential back-off when the
 * connection drops (network glitch, server restart, etc.) and exposes the
 * current connection state so the UI can surface it instead of failing
 * silently.
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

/** Live-stream connection state, surfaced to the UI so a dropped connection is never silent. */
export type SseConnectionState = "connected" | "reconnecting" | "offline";

/**
 * Subscribe to real-time status-change events from the server.
 *
 * @param onStatusChanged - Called whenever a service order status changes.
 *   Stable reference recommended (wrap in useCallback) to avoid reconnects.
 * @param onReconnect - Called after the stream re-establishes following a
 *   drop (e.g. server restart). Not called on the initial connect. Use it to
 *   refresh data that may have changed while disconnected.
 *   Stable reference recommended (wrap in useCallback) to avoid reconnects.
 * @returns The current connection state: "connected", "reconnecting", or
 *   "offline" (browser reports no network at all).
 */
export function useStatusEvents(
  onStatusChanged: StatusChangedCallback,
  onReconnect?: () => void,
): SseConnectionState {
  const callbackRef = useRef(onStatusChanged);
  const reconnectRef = useRef(onReconnect);
  const [connectionState, setConnectionState] = useState<SseConnectionState>("connected");

  // Keep refs current without restarting the SSE connection on every render.
  useEffect(() => {
    callbackRef.current = onStatusChanged;
    reconnectRef.current = onReconnect;
  });

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 1_000; // ms, doubles on each failure up to 30 s
    let destroyed = false;
    let hasConnectedBefore = false;

    function updateState() {
      if (destroyed) return;
      setConnectionState(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "reconnecting");
    }

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
        es?.close();
        es = null;
        if (destroyed) return;
        updateState();
        // Exponential back-off reconnect
        retryTimer = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 30_000);
          connect();
        }, retryDelay);
      };

      es.onopen = () => {
        // Reset back-off on successful open
        retryDelay = 1_000;
        setConnectionState("connected");
        if (hasConnectedBefore) {
          // Reconnected after a drop — let the UI catch up on missed changes.
          reconnectRef.current?.();
        }
        hasConnectedBefore = true;
      };
    }

    function handleOffline() {
      updateState();
    }

    window.addEventListener("offline", handleOffline);
    connect();

    return () => {
      destroyed = true;
      window.removeEventListener("offline", handleOffline);
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, []); // intentionally empty — connection is managed manually

  return connectionState;
}
