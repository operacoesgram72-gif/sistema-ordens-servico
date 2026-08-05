import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw, Share2, Copy, CheckCircle2, X, User,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isSameDay, addMonths, subMonths,
} from "date-fns";
import { useListServiceOrders, useListTechnicians } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUnit } from "@/contexts/unit-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_LABELS, FORMATO_SERVICO_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { CalendarSummaryCards, type CalendarSummary } from "@/components/calendario/summary-cards";
import { OrderChip, STATUS_COLORS, STATUS_DOT, isOverdue, type CalendarOrder } from "@/components/calendario/order-chip";
import { OrderDetailsDrawer } from "@/components/calendario/order-drawer";

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

// Max OS chips shown directly inside a day cell before collapsing into "+X OS".
const MAX_VISIBLE_PER_DAY = 2;

type QuickFilter = "todos" | "minhas" | "aberta" | "em_andamento" | "concluida" | "cancelada" | "urgente";

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "minhas", label: "Minhas OS" },
  { key: "aberta", label: "Abertas" },
  { key: "em_andamento", label: "Em Andamento" },
  { key: "concluida", label: "Concluídas" },
  { key: "cancelada", label: "Canceladas" },
  { key: "urgente", label: "Urgentes" },
];

// Persists which technician "is me" for the "Minhas OS" quick filter — purely
// a local UI convenience (no auth system exists in this app), stored per
// browser and scoped only to this page.
const MY_TECH_STORAGE_KEY = "calendario_meu_tecnico_id";

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
  const [selectedOrder, setSelectedOrder] = useState<CalendarOrder | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("todos");
  const [formatoFilter, setFormatoFilter] = useState<string>("todos");
  const [myTechId, setMyTechId] = useState<string>(() => localStorage.getItem(MY_TECH_STORAGE_KEY) || "");

  // Key stabilised — period:"annual" always returns the current year so the year
  // number does NOT need to be part of the key; including it caused a new fetch
  // on every month-navigation click even though the server response was identical.
  const queryKey = useMemo(() => ["service-orders-calendar", unit], [unit]);

  const { data: orders = [] } = useListServiceOrders(
    { period: "annual", unidade: unit } as any,
    { query: { enabled: true, queryKey } }
  );

  const { data: technicians = [] } = useListTechnicians(
    { unidade: unit } as any,
    { query: { enabled: !isReadOnly, queryKey: ["calendario-technicians", unit] } }
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey });
    setRefreshing(false);
  }, [queryClient, queryKey]);

  const shareViewUrl = `${window.location.origin}${BASE_URL}/calendario?view=1`;

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareViewUrl).then(() => {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
      toast({ title: "Link de visualização copiado!", description: "Compartilhe para permitir somente leitura." });
    });
  };

  useEffect(() => {
    if (myTechId) localStorage.setItem(MY_TECH_STORAGE_KEY, myTechId);
  }, [myTechId]);

  const unitOrders = useMemo(
    () => (orders as any[]).filter((os: any) => !os.unidade || os.unidade === unit),
    [orders, unit]
  );

  // Quick-filter + formato filter applied on top of the unit-scoped orders —
  // affects only what is shown in the grid, never the underlying data.
  const filteredOrders = useMemo(() => {
    let base: any[];
    switch (quickFilter) {
      case "minhas":
        base = myTechId
          ? unitOrders.filter((os: any) => String(os.technicianId ?? "") === myTechId)
          : [];
        break;
      case "urgente":
        base = unitOrders.filter((os: any) => os.priority === "urgente");
        break;
      case "aberta":
      case "em_andamento":
      case "concluida":
      case "cancelada":
        base = unitOrders.filter((os: any) => os.status === quickFilter);
        break;
      default:
        base = unitOrders;
    }
    if (formatoFilter !== "todos") {
      base = base.filter((os: any) => os.formatoServico === formatoFilter);
    }
    return base;
  }, [unitOrders, quickFilter, myTechId, formatoFilter]);

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

  // Max OS count across the visible month — used to scale the "busy day"
  // highlight so it stays relative to this month, not an absolute number.
  const maxOrdersInMonth = useMemo(() => {
    let max = 0;
    for (const week of weeks) {
      for (const date of week) {
        if (!isSameMonth(date, currentDate)) continue;
        const key = format(date, "yyyy-MM-dd");
        max = Math.max(max, (ordersByDate.get(key) || []).length);
      }
    }
    return max;
  }, [weeks, currentDate, ordersByDate]);

  // Summary cards — scoped to the currently visible month (unit-filtered,
  // independent from the quick filter chips so it always reflects the full
  // picture regardless of which subset is being browsed).
  const monthSummary: CalendarSummary = useMemo(() => {
    const inMonth = unitOrders.filter((os: any) => {
      const raw = os.scheduledAt || os.createdAt;
      if (!raw) return false;
      const d = new Date(raw);
      return d >= monthStart && d <= monthEnd;
    });
    return {
      total: inMonth.length,
      abertas: inMonth.filter((os: any) => os.status === "aberta").length,
      emAndamento: inMonth.filter((os: any) => os.status === "em_andamento").length,
      concluidas: inMonth.filter((os: any) => os.status === "concluida").length,
      canceladas: inMonth.filter((os: any) => os.status === "cancelada").length,
      atrasadas: inMonth.filter((os: any) => isOverdue(os)).length,
    };
  }, [unitOrders, monthStart, monthEnd]);

  // Orders for the selected day (used in the expansion modal)
  const selectedDayOrders = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, "yyyy-MM-dd");
    return ordersByDate.get(key) || [];
  }, [selectedDay, ordersByDate]);

  const openOrder = (os: CalendarOrder) => setSelectedOrder(os);

  const goToFullOrder = (id: number | string) => {
    setSelectedOrder(null);
    setSelectedDay(null);
    setLocation(`/ordens/${id}`);
  };

  const handleNewOsForDay = (date: Date) => {
    if (isReadOnly) return;
    setLocation(`/ordens/nova?data=${format(date, "yyyy-MM-dd")}`);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="bg-background border-b border-border/30 shrink-0">
        <div className="px-4 md:px-6 pt-4 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-4 md:px-6 pb-6 pt-4 space-y-4">

      {/* Summary cards */}
      <CalendarSummaryCards summary={monthSummary} />

      {/* Quick filters + formato filter */}
      <div className="flex flex-wrap items-center gap-2">
        {QUICK_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setQuickFilter(f.key)}
            className={cn(
              "text-xs font-medium px-3 py-1.5 rounded-full border transition-all",
              quickFilter === f.key
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}

        {/* Formato de serviço filter — combinável com os demais chips */}
        <Select value={formatoFilter} onValueChange={setFormatoFilter}>
          <SelectTrigger className="h-7 text-xs w-[150px]">
            <SelectValue placeholder="Formato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Formatos</SelectItem>
            {Object.entries(FORMATO_SERVICO_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {quickFilter === "minhas" && !isReadOnly && (
          <div className="flex items-center gap-1.5 ml-1">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            <Select value={myTechId} onValueChange={setMyTechId}>
              <SelectTrigger className="h-7 text-xs w-[160px]">
                <SelectValue placeholder="Eu sou..." />
              </SelectTrigger>
              <SelectContent>
                {(technicians as any[]).map((t: any) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
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
                const isBusyDay = maxOrdersInMonth >= 3 && dayOrders.length >= Math.max(3, Math.ceil(maxOrdersInMonth * 0.7));

                return (
                  <div
                    key={di}
                    onClick={() => hasOrders && setSelectedDay(date)}
                    onDoubleClick={() => handleNewOsForDay(date)}
                    className={cn(
                      "min-h-[90px] md:min-h-[110px] p-1 border-r border-border/20 last:border-r-0 transition-all duration-150",
                      !isCurrentMonth && "bg-muted/20",
                      isToday && "bg-primary/[0.07] ring-1 ring-inset ring-primary/40",
                      isBusyDay && !isToday && "bg-amber-500/[0.06]",
                      hasOrders && "cursor-pointer hover:bg-muted/30",
                      !isReadOnly && "cursor-pointer"
                    )}
                    title={
                      hasOrders
                        ? `${dayOrders.length} ordem${dayOrders.length > 1 ? "s" : ""} — clique para expandir${!isReadOnly ? " · duplo clique para nova OS" : ""}`
                        : !isReadOnly
                        ? "Duplo clique para criar uma nova OS nesta data"
                        : undefined
                    }
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-1">
                      <div className={cn(
                        "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                        isToday
                          ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30"
                          : isCurrentMonth
                          ? "text-foreground"
                          : "text-muted-foreground/30"
                      )}>
                        {format(date, "d")}
                      </div>
                      {isBusyDay && (
                        <span className="text-[9px] font-semibold text-amber-500 bg-amber-500/10 rounded-full px-1.5 py-0.5">
                          {dayOrders.length}
                        </span>
                      )}
                    </div>

                    {/* Order chips */}
                    <div className="space-y-0.5">
                      {dayOrders.slice(0, MAX_VISIBLE_PER_DAY).map((os: any) => (
                        <OrderChip
                          key={os.id}
                          os={os}
                          dense
                          onClick={(e) => { e.stopPropagation(); openOrder(os); }}
                        />
                      ))}
                      {dayOrders.length > MAX_VISIBLE_PER_DAY && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedDay(date); }}
                          className="text-[10px] font-medium text-primary/70 hover:text-primary pl-1 w-full text-left transition-colors"
                        >
                          +{dayOrders.length - MAX_VISIBLE_PER_DAY} OS
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
          : "💡 Clique em um dia para expandir · Duplo clique em um dia para criar uma OS · Clique em uma OS para ver os detalhes"}
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
            {selectedDayOrders.map((os: any) => {
              const overdue = isOverdue(os);
              return (
                <button
                  key={os.id}
                  onClick={() => openOrder(os)}
                  className={cn(
                    "w-full text-left rounded-lg border p-3 space-y-1.5 transition-colors",
                    "bg-muted/30 border-border/50 hover:bg-muted/50 hover:border-border"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className={cn("w-2 h-2 rounded-full shrink-0 mt-1.5", STATUS_DOT[os.status] || "bg-muted")} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground leading-snug flex items-center gap-1.5">
                          {os.title}
                          {overdue && <span title="Atrasada" className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
                        </p>
                        <p className="text-xs text-muted-foreground">{os.number}</p>
                      </div>
                    </div>
                    <span className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0",
                      STATUS_COLORS[os.status as keyof typeof STATUS_COLORS] || "bg-muted/50 text-muted-foreground border-border"
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
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* OS details side panel */}
      <OrderDetailsDrawer
        order={selectedOrder}
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => !open && setSelectedOrder(null)}
        onOpenFull={goToFullOrder}
        readOnly={isReadOnly}
      />
    
        </div>
      </div>
    </div>
  );
}
