import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isSameDay, addMonths, subMonths,
} from "date-fns";
import { useListServiceOrders } from "@workspace/api-client-react";
import { useUnit } from "@/contexts/unit-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<string, string> = {
  aberta: "bg-blue-500",
  em_andamento: "bg-yellow-500",
  concluida: "bg-emerald-500",
  cancelada: "bg-red-500",
};

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function Calendario() {
  const [, setLocation] = useLocation();
  const { unit } = useUnit();
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: orders = [] } = useListServiceOrders(
    { period: "annual" } as any,
    { query: { enabled: true, queryKey: ["service-orders-calendar", unit, currentDate.getFullYear()] } }
  );

  const filteredOrders = useMemo(
    () => orders.filter((os: any) => !os.unidade || os.unidade === unit),
    [orders, unit]
  );

  const ordersByDate = useMemo(() => {
    const map = new Map<string, typeof filteredOrders>();
    for (const os of filteredOrders) {
      const raw = (os as any).scheduledAt || os.createdAt;
      const dateKey = format(new Date(raw), "yyyy-MM-dd");
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(os);
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

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <CalendarDays className="w-7 h-7 text-primary" />
            Calendário
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
          <Button size="sm" onClick={() => setLocation("/ordens/nova")} className="gap-2 hidden sm:flex">
            <Plus className="w-4 h-4" />
            Nova OS
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs">
        {Object.entries(STATUS_DOT).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5 text-muted-foreground">
            <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", color)} />
            <span>{STATUS_LABELS[status as keyof typeof STATUS_LABELS]}</span>
          </div>
        ))}
      </div>

      <Card className="bg-card border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b border-border bg-muted/30">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2.5 border-r border-border/30 last:border-r-0">
                {d}
              </div>
            ))}
          </div>

          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-border/30 last:border-b-0">
              {week.map((date, di) => {
                const dateKey = format(date, "yyyy-MM-dd");
                const dayOrders = ordersByDate.get(dateKey) || [];
                const isCurrentMonth = isSameMonth(date, currentDate);
                const isToday = isSameDay(date, today);

                return (
                  <div
                    key={di}
                    className={cn(
                      "min-h-[90px] md:min-h-[110px] p-1 border-r border-border/20 last:border-r-0 transition-colors",
                      !isCurrentMonth && "bg-muted/20",
                      isToday && "bg-primary/5"
                    )}
                  >
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

                    <div className="space-y-0.5">
                      {dayOrders.slice(0, 3).map((os: any) => (
                        <button
                          key={os.id}
                          onClick={() => setLocation(`/ordens/${os.id}`)}
                          className="w-full text-left flex items-center gap-1 px-1 py-0.5 rounded text-[10px] hover:bg-muted/60 transition-colors group"
                          title={`${os.number} — ${os.title}`}
                        >
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[os.status] || "bg-muted")} />
                          <span className="truncate text-foreground/80 group-hover:text-primary leading-tight">
                            {os.number}
                          </span>
                        </button>
                      ))}
                      {dayOrders.length > 3 && (
                        <div className="text-[10px] text-muted-foreground/60 pl-1">
                          +{dayOrders.length - 3}
                        </div>
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
        💡 Clique em qualquer OS no calendário para ver os detalhes · OS mostradas na data de agendamento ou criação
      </p>

      {/* Floating Action Button (mobile only) */}
      <button
        onClick={() => setLocation("/ordens/nova")}
        aria-label="Nova Ordem de Serviço"
        className="fab sm:hidden"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
