/**
 * StatusAlertsBell — notification bell for the dispatcher layout.
 *
 * Shows a badge with the unread count; clicking opens a popover with recent
 * status-change alerts. Clicking an alert navigates to that order's detail page.
 */
import { useLocation } from "wouter";
import { Bell, BellRing, ClipboardList, Trash2 } from "lucide-react";
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
  const { alerts, unreadCount, markAllRead, clearAll } = useStatusAlerts();

  const hasAlerts = alerts.length > 0;
  const hasUnread = unreadCount > 0;

  const handleOpen = (open: boolean) => {
    if (open && hasUnread) {
      // Mark all read when the popover opens
      markAllRead();
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
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 p-0 bg-card border border-border shadow-xl"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm font-semibold">Atualizações de OS</span>
            {hasAlerts && (
              <Badge variant="outline" className="text-[10px] px-1.5 h-4">
                {alerts.length}
              </Badge>
            )}
          </div>
          {hasAlerts && (
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

        {/* Alert list */}
        {!hasAlerts ? (
          <div className="px-4 py-8 text-center">
            <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma atualização ainda</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Alertas de mudança de status aparecerão aqui em tempo real.
            </p>
          </div>
        ) : (
          <ul className="max-h-[340px] overflow-y-auto divide-y divide-border/50">
            {alerts.map((alert, idx) => {
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
