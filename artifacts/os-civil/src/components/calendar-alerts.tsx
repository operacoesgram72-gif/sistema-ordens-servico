/**
 * CalendarAlerts
 *
 * Shows a non-blocking floating popup when there are service orders
 * scheduled for tomorrow. Dismissed once per day per unit (sessionStorage).
 */
import { useState, useMemo, useEffect } from "react";
import { X, Bell, Clock } from "lucide-react";
import { format, addDays } from "date-fns";
import { useListServiceOrders } from "@workspace/api-client-react";
import { useUnit } from "@/contexts/unit-context";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<string, string> = {
  aberta: "bg-blue-500",
  em_andamento: "bg-yellow-500",
  concluida: "bg-emerald-500",
  cancelada: "bg-red-500",
};

export default function CalendarAlerts() {
  const { unit } = useUnit();

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const sessionKey = `calAlerts-${todayKey}-${unit}`;

  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(sessionKey) === "1"; } catch { return false; }
  });

  // Re-sync dismissal when unit or date changes (sessionKey changes between sessions)
  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(sessionKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [sessionKey]);

  const { data: orders = [] } = useListServiceOrders(
    { period: "annual" } as any,
    {
      query: {
        queryKey: ["service-orders-alerts", unit],
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 15,
      },
    }
  );

  const tomorrow = addDays(new Date(), 1);
  const tomorrowKey = format(tomorrow, "yyyy-MM-dd");

  const tomorrowOrders = useMemo(() => {
    return (orders as any[]).filter((os) => {
      // Only show for the current unit
      if (os.unidade && os.unidade !== unit) return false;
      const raw = os.scheduledAt || os.createdAt;
      if (!raw) return false;
      try {
        return format(new Date(raw), "yyyy-MM-dd") === tomorrowKey;
      } catch {
        return false;
      }
    });
  }, [orders, unit, tomorrowKey]);

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(sessionKey, "1"); } catch {}
  };

  if (dismissed || tomorrowOrders.length === 0) return null;

  const tomorrowLabel = format(tomorrow, "dd/MM/yyyy");

  return (
    <div className="fixed bottom-5 right-5 z-[55] w-80 max-w-[calc(100vw-2.5rem)]">
      <div
        className="bg-card border border-amber-500/40 rounded-xl shadow-xl overflow-hidden"
        style={{ animation: "slideInFromBottom 0.25s ease-out" }}
      >
        {/* Header */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-sm font-semibold text-amber-400">
              Lembrete de Amanhã
            </span>
          </div>
          <button
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground transition-colors ml-auto shrink-0 rounded p-0.5 hover:bg-muted"
            title="Dispensar"
            aria-label="Dispensar alerta"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3 shrink-0" />
            <span>
              {tomorrowOrders.length} serviço{tomorrowOrders.length !== 1 ? "s" : ""}{" "}
              programado{tomorrowOrders.length !== 1 ? "s" : ""} para{" "}
              <strong className="text-foreground">{tomorrowLabel}</strong> — {unit}
            </span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
            {tomorrowOrders.map((os: any) => (
              <div
                key={os.id}
                className="flex items-start gap-2 rounded-md bg-muted/40 px-2.5 py-2"
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full shrink-0 mt-1",
                    STATUS_DOT[os.status] || "bg-muted-foreground"
                  )}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate leading-snug">
                    {os.title || os.number}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    {os.number}
                    {os.location ? ` · ${os.location}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/40 px-3 py-2 flex justify-end">
          <button
            onClick={dismiss}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Dispensar
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInFromBottom {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
