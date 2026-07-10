/**
 * StatusAlertsBell — notification bell for the dispatcher layout.
 *
 * Shows a badge with the unread count; clicking opens a popover with recent
 * status-change alerts. Clicking an alert navigates to that order's detail page.
 *
 * Additions:
 *  - Live-stream connection dot on the bell icon (task #18)
 *  - Sticky connection status bar inside the popover (task #19)
 *  - Unit filter dropdown inside the popover (task #13)
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Bell, BellRing, ClipboardList, Trash2, Wifi, WifiOff, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useStatusAlerts } from "@/contexts/status-alerts-context";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import type { ServiceOrderStatus } from "@workspace/api-client-react";

interface StatusAlertsBellProps {
  /** "sidebar" → icon is larger, used inside desktop sidebar header */
  variant?: "topbar" | "sidebar";
  onNavigate?: () => void;
}

export function StatusAlertsBell({ variant = "topbar", onNavigate }: StatusAlertsBellProps) {
  const [, setLocation] = useLocation();
  const { alerts, unreadCount, isConnected, markAllRead, clearAll } = useStatusAlerts();
  const [filterUnit, setFilterUnit] = useState<string>("");

  // ── Task #13: derive unique units from the current alert list ──────────────
  const availableUnits = useMemo(
    () => [...new Set(alerts.map(a => a.unidade))].sort(),
    [alerts],
  );

  const filteredAlerts = useMemo(
    () => filterUnit ? alerts.filter(a => a.unidade === filterUnit) : alerts,
    [alerts, filterUnit],
  );

  const hasAlerts = filteredAlerts.length > 0;
  const hasUnread = unreadCount > 0;

  const handleOpen = (open: boolean) => {
    if (open && hasUnread) {
      markAllRead();
    }
    if (!open) {
      // Reset unit filter when popover closes
      setFilterUnit("");
    }
  };

  const handleAlertClick = (orderId: number) => {
    setLocation(`/ordens/${orderId}`);
    onNavigate?.();
  };

  const iconSize = variant === "sidebar" ? "w-4 h-4" : "w-4 h-4";

  return (
    <Popover onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "relative flex items-center justify-center rounded-md transition-colors",
            variant === "topbar"
              ? "p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
              : "p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60"
          )}
          aria-label={hasUnread ? `${unreadCount} alertas não lidos` : "Alertas de status"}
          title={hasUnread ? `${unreadCount} atualização${unreadCount !== 1 ? "ões" : ""} nova${unreadCount !== 1 ? "s" : ""}` : "Alertas de atualização de OS"}
        >
          {hasUnread
            ? <BellRing className={cn(iconSize, "text-primary animate-[wiggle_0.4s_ease-in-out]")} />
            : <Bell className={iconSize} />
          }
          {hasUnread && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-0.5 leading-none tabular-nums">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
          {/* ── Task #18: live-stream connection dot on the bell ── */}
          {!hasUnread && (
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background",
                isConnected ? "bg-emerald-500" : "bg-amber-500 animate-pulse",
              )}
              title={isConnected ? "Tempo real: conectado" : "Tempo real: reconectando..."}
            />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 p-0 bg-card border border-border shadow-xl"
        align="end"
        sideOffset={8}
      >
        {/* ── Task #19: sticky connection status bar ─────────────────────── */}
        <div
          className={cn(
            "sticky top-0 z-10 flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium border-b",
            isConnected
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-600/20"
              : "bg-amber-500/10 text-amber-400 border-amber-600/20 animate-pulse",
          )}
        >
          {isConnected
            ? <><Wifi className="w-3 h-3" />Tempo real: conectado</>
            : <><WifiOff className="w-3 h-3" />Reconectando ao servidor...</>
          }
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm font-semibold">Atualizações de OS</span>
            {alerts.length > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 h-4">
                {filteredAlerts.length}{filterUnit ? `/${alerts.length}` : ""}
              </Badge>
            )}
          </div>
          {alerts.length > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
              title="Limpar todos"
            >
              <Trash2 className="w-3 h-3" />
              Limpar
            </button>
          )}
        </div>

        {/* ── Task #13: unit filter ──────────────────────────────────────── */}
        {availableUnits.length > 1 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-muted/20">
            <Filter className="w-3 h-3 text-muted-foreground shrink-0" />
            <select
              value={filterUnit}
              onChange={e => setFilterUnit(e.target.value)}
              className="flex-1 text-[11px] bg-transparent text-foreground border-0 outline-none cursor-pointer appearance-none"
            >
              <option value="">Todas as unidades</option>
              {availableUnits.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        )}

        {/* Alert list */}
        {!hasAlerts ? (
          <div className="px-4 py-8 text-center">
            <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {filterUnit ? `Nenhuma atualização para ${filterUnit}` : "Nenhuma atualização ainda"}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Alertas de mudança de status aparecerão aqui em tempo real.
            </p>
          </div>
        ) : (
          <ul className="max-h-[300px] overflow-y-auto divide-y divide-border/50">
            {filteredAlerts.map((alert, idx) => {
              const statusLabel = STATUS_LABELS[alert.status as ServiceOrderStatus] || alert.status;
              const statusColor = STATUS_COLORS[alert.status as ServiceOrderStatus] || "";
              const timeAgo = formatDistanceToNow(new Date(alert.receivedAt), {
                addSuffix: true,
                locale: ptBR,
              });

              return (
                <li key={`${alert.id}-${idx}`}>
                  <button
                    onClick={() => handleAlertClick(alert.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 transition-colors hover:bg-muted/50 group",
                      !alert.read && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        <ClipboardList className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-primary">
                            OS {alert.number}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] px-1.5 h-4 shrink-0", statusColor)}
                          >
                            {statusLabel}
                          </Badge>
                          {!alert.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate leading-tight">
                          {alert.title}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                          <span>{alert.unidade}</span>
                          <span>·</span>
                          <span>{timeAgo}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Footer hint */}
        {hasAlerts && (
          <div className="px-4 py-2 border-t border-border/50 text-center">
            <p className="text-[10px] text-muted-foreground/50">
              Clique em uma atualização para ver a OS
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
