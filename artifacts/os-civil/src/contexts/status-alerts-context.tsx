/**
 * StatusAlertsContext — global SSE subscription for the dispatcher view.
 *
 * Lives at the ManagementRouter level so all dispatcher pages get live
 * status-change notifications regardless of which route is active.
 */
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { useStatusEvents, type StatusChangedEvent } from "@/hooks/use-status-events";

export interface StatusAlert extends StatusChangedEvent {
  /** Local timestamp when we received the event */
  receivedAt: string;
  read: boolean;
}

interface StatusAlertsContextValue {
  alerts: StatusAlert[];
  unreadCount: number;
  markAllRead: () => void;
  clearAll: () => void;
}

const StatusAlertsContext = createContext<StatusAlertsContextValue>({
  alerts: [],
  unreadCount: 0,
  markAllRead: () => {},
  clearAll: () => {},
});

const MAX_ALERTS = 30;

export function StatusAlertsProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<StatusAlert[]>([]);
  // Track IDs we've already seen to avoid duplicate toasts on reconnect
  const seenRef = useRef<Set<string>>(new Set());

  const handleStatusChanged = useCallback((event: StatusChangedEvent) => {
    // Deduplicate: same order + same status within this session
    const key = `${event.id}:${event.status}:${event.updatedAt}`;
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);

    const alert: StatusAlert = {
      ...event,
      receivedAt: new Date().toISOString(),
      read: false,
    };

    setAlerts(prev => {
      const next = [alert, ...prev];
      return next.slice(0, MAX_ALERTS);
    });
  }, []);

  useStatusEvents(handleStatusChanged);

  const markAllRead = useCallback(() => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setAlerts([]);
    seenRef.current.clear();
  }, []);

  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <StatusAlertsContext.Provider value={{ alerts, unreadCount, markAllRead, clearAll }}>
      {children}
    </StatusAlertsContext.Provider>
  );
}

export function useStatusAlerts() {
  return useContext(StatusAlertsContext);
}
