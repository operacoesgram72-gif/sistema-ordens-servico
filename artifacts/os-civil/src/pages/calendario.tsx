import { useState, useMemo, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw, Share2, Copy, CheckCircle2, X } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isSameDay, addMonths, subMonths,
} from "date-fns";
import { useListServiceOrders } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUnit } from "@/contexts/unit-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const STATUS_DOT: Record<string, string> = {
  aberta: "bg-blue-500",
  em_andamento: "bg-yellow-500",
  concluida: "bg-emerald-500",
  cancelada: "bg-red-500",
};

const STATUS_BADGE: Record<string, string> = {
  aberta: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  em_andamento: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  concluida: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  cancelada: "bg-red-500/15 text-red-400 border-red-500/30",
};

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Calendario() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { unit } = useUnit();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Read-only / view-only mode (for shared links)
  const isReadOnly = new URLSearchParams(search).get("view") === "1";

  const [currentDate, setCurrentDate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const queryKey = ["service-orders-calendar", unit, currentDate.getFullYear()];

  const { data: orders = [] } = useListServiceOrders(
    { period: "annual" } as any,
    { query: { enabled: true, queryKey } }
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey });
    setRefreshing(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, unit, currentDate.getFullYear()]);

  const shareViewUrl = `${window.location.origin}${BASE_URL}/calendario?view=1`;

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareViewUrl).then(() => {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
      toast({ title: "Link de visualização copiado!", description: "Compartilhe para permitir somente leitura." });
    });
  };

  const filteredOrders = useMemo(
    () => (orders as any[]).filter((os: any) => !os.unidade || os.unidade === unit),
    [orders, unit]
  );

  const ordersByDate = useMemo(() => {
    const map = new Map<string, typeof filteredOrders>();
    for (const os of filteredOrders) {
      const raw = (os as any).scheduledAt || os.createdAt;
      if (!raw) continue;
      try {
        const dateKey = format(new Date(raw), "yyyy-MM-dd");
        if (!map.has(dateKey)) map.set(dateKey, []);
        map.get(dateKey)!.push(os);
      } catch {
        // skip malformed dates
      }
    }
    return map;
  }, [filteredOrders]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const weeks: Date[][] = [];
  let day = calStart;
  while (day <= calEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  const today = new Date();

  // Orders for the selected day (used in the expansion modal)
  const selectedDayOrders = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, "yyyy-MM-dd");
    return ordersByDate.get(key) || [];
  }, [selectedDay, ordersByDate]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <CalendarDays className="w-7 h-7 text-primary" />
            Calendário
            {isReadOnly && (
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                Somente Visualização
              </span>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            Ordens de serviço agendadas e registradas por data — Unidade: <strong>{unit}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(d => subMonths(d, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="px-4 py-1.5 bg-card border border-border rounded-md text-sm font-semibold min-w-[160px] text-center">
            {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
          </div>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(d => addMonths(d, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-1.5">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          {!isReadOnly && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={copyShareLink}
                className="gap-1.5 hidden sm:flex"
                title="Copiar link somente leitura"
              >
                {copiedShare ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
                Compartilhar
              </Button>
              <Button size="sm" onClick={() => setLocation("/ordens/nova")} className="gap-2 hidden sm:flex">
                <Plus className="w-4 h-4" />
                Nova OS
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        {Object.entries(STATUS_DOT).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5 text-muted-foreground">
            <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", color)} />
            <span>{STATUS_LABELS[status as keyof typeof STATUS_LABELS]}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <Card className="bg-card border-border/50 overflow-hidden">
        <CardContent className="p-0">
          {/* Day name header */}
          <div className="grid grid-cols-7 border-b border-border bg-muted/30">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2.5 border-r border-border/30 last:border-r-0">
                {d}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-border/30 last:border-b-0">
              {week.map((date, di) => {
                const dateKey = format(date, "yyyy-MM-dd");
                const dayOrders = ordersByDate.get(dateKey) || [];
                const isCurrentMonth = isSameMonth(date, currentDate);
                const isToday = isSameDay(date, today);
                const hasOrders = dayOrders.length > 0;

                return (
                  <div
                    key={di}
                    onClick={() => hasOrders && setSelectedDay(date)}
                    className={cn(
                      "min-h-[90px] md:min-h-[110px] p-1 border-r border-border/20 last:border-r-0 transition-colors",
                      !isCurrentMonth && "bg-muted/20",
                      isToday && "bg-primary/5",
                      hasOrders && "cursor-pointer hover:bg-muted/30"
                    )}
                    title={hasOrders ? `${dayOrders.length} ordem${dayOrders.length > 1 ? "s" : ""} — clique para expandir` : undefined}
                  >
                    {/* Day number */}
                    <div className={cn(
                      "text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : isCurrentMonth
                        ? "text-foreground"
                        : "text-muted-foreground/30"
                    )}>
                      {format(date, "d")}
                    </div>

                    {/* Order dots */}
                    <div className="space-y-0.5">
                      {dayOrders.slice(0, 3).map((os: any) => (
                        <button
                          key={os.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isReadOnly) setLocation(`/ordens/${os.id}`);
                          }}
                          className={cn(
                            "w-full text-left flex items-center gap-1 px-1 py-0.5 rounded text-[10px] transition-colors group",
                            isReadOnly ? "cursor-default" : "hover:bg-muted/60"
                          )}
                          title={`${os.number} — ${os.title}`}
                        >
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[os.status] || "bg-muted")} />
                          <span className="truncate text-foreground/80 group-hover:text-primary leading-tight">
                            {os.number}
                          </span>
                        </button>
                      ))}
                      {dayOrders.length > 3 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedDay(date); }}
                          className="text-[10px] text-primary/70 hover:text-primary pl-1 w-full text-left transition-colors"
                        >
                          +{dayOrders.length - 3} mais
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {isReadOnly
          ? "📅 Modo de visualização — somente leitura"
          : "💡 Clique em qualquer dia com OS para expandir · Clique em uma OS para ver os detalhes"}
      </p>

      {/* Floating Action Button (mobile only) */}
      {!isReadOnly && (
        <button
          onClick={() => setLocation("/ordens/nova")}
          aria-label="Nova Ordem de Serviço"
          className="fab sm:hidden"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Day expansion modal */}
      <Dialog open={Boolean(selectedDay)} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              {selectedDay
                ? `${DAY_NAMES[selectedDay.getDay()]}, ${format(selectedDay, "d")} de ${MONTH_NAMES[selectedDay.getMonth()]} de ${selectedDay.getFullYear()}`
                : ""}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedDayOrders.length} ordem{selectedDayOrders.length !== 1 ? "s" : ""} — Unidade {unit}
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-2">
            {selectedDayOrders.map((os: any) => (
              <div
                key={os.id}
                className={cn(
                  "rounded-lg border p-3 space-y-1.5",
                  "bg-muted/30 border-border/50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className={cn("w-2 h-2 rounded-full shrink-0 mt-1.5", STATUS_DOT[os.status] || "bg-muted")} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground leading-snug">{os.title}</p>
                      <p className="text-xs text-muted-foreground">{os.number}</p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0",
                    STATUS_BADGE[os.status] || "bg-muted/50 text-muted-foreground border-border"
                  )}>
                    {STATUS_LABELS[os.status as keyof typeof STATUS_LABELS] || os.status}
                  </span>
                </div>

                {os.location && (
                  <p className="text-xs text-muted-foreground pl-4 truncate">{os.location}</p>
                )}

                {(os.scheduledAt || os.createdAt) && (
                  <p className="text-[10px] text-muted-foreground/60 pl-4">
                    {os.scheduledAt
                      ? `Agendado: ${format(new Date(os.scheduledAt), "dd/MM/yyyy")}`
                      : `Criado: ${format(new Date(os.createdAt), "dd/MM/yyyy")}`}
                  </p>
                )}

                {!isReadOnly && (
                  <div className="pl-4">
                    <button
                      onClick={() => { setSelectedDay(null); setLocation(`/ordens/${os.id}`); }}
                      className="text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      Ver detalhes →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
