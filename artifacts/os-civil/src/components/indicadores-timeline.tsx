import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardPlus, CheckCircle2, CalendarClock, Package, History, List, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useUnit } from "@/contexts/unit-context";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type TimelineEventType = "os_criada" | "os_concluida" | "os_programada" | "material";

interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  subtitle: string | null;
  date: string;
}

// Discreet, low-saturation colors per event type — matches the existing card
// accent-color pattern used elsewhere in Indicadores (icon + colored value),
// without introducing any new palette colors.
const EVENT_META: Record<TimelineEventType, { icon: typeof ClipboardPlus; color: string; bg: string; hex: string; label: string }> = {
  os_criada:     { icon: ClipboardPlus,  color: "text-primary",       bg: "bg-primary/10",       hex: "hsl(var(--primary))", label: "OS Criadas" },
  os_concluida:  { icon: CheckCircle2,   color: "text-emerald-500",   bg: "bg-emerald-500/10",   hex: "#10b981",             label: "OS Concluídas" },
  os_programada: { icon: CalendarClock,  color: "text-blue-400",      bg: "bg-blue-400/10",      hex: "#60a5fa",             label: "OS Programadas" },
  material:      { icon: Package,        color: "text-amber-500",     bg: "bg-amber-500/10",     hex: "#f59e0b",             label: "Materiais" },
};

const EVENT_TYPES: TimelineEventType[] = ["os_criada", "os_concluida", "os_programada", "material"];

/**
 * Always includes the exact time of day the event happened, alongside a
 * relative/absolute label for context — e.g. "há 2h · 14:35" or
 * "12/07/26 · 09:10". The list (histórico) view is the only place this is
 * used; the chart view is unaffected.
 */
function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  const diffH = Math.round(diffMin / 60);
  const diffD = Math.round(diffH / 24);

  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

  if (diffMs < 0) {
    // Future event (e.g. scheduled OS) — show absolute date + time.
    return `${dateStr} · ${time}`;
  }
  if (diffMin < 1) return `agora mesmo · ${time}`;
  if (diffMin < 60) return `há ${diffMin} min · ${time}`;
  if (diffH < 24) return `há ${diffH}h · ${time}`;
  if (diffD < 7) return `há ${diffD}d · ${time}`;
  return `${dateStr} · ${time}`;
}

interface IndicadoresTimelineProps {
  /** When set, only events for this technician are shown (multi-tech OS included). */
  tecnico?: string;
}

/**
 * Timeline of recent events for the Indicadores screen.
 * Purely additive widget — reads from GET /api/dashboard/timeline (read-only
 * aggregation endpoint) and renders as a standalone Card. Does not alter,
 * wrap, or depend on any other section of the page.
 *
 * When `tecnico` is provided, the API filters OS events so only events where
 * the technician participated appear. Multi-tech OS ("A / B") are included
 * for both A and B without creating duplicate records.
 */
export default function IndicadoresTimeline({ tecnico }: IndicadoresTimelineProps) {
  const { unit } = useUnit();
  const [viewMode, setViewMode] = useState<"lista" | "grafico">("lista");

  const { data: events, isLoading } = useQuery<TimelineEvent[]>({
    queryKey: ["dashboard-timeline", unit, tecnico ?? "all"],
    queryFn: async () => {
      const params = new URLSearchParams({ unidade: unit, limit: "25" });
      if (tecnico && tecnico !== "all") params.set("tecnico", tecnico);
      const res = await fetch(`${BASE_URL}/api/dashboard/timeline?${params.toString()}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // Aggregate the same events (list source of truth) into per-day counts by
  // type, oldest → newest, for the chart view. Purely derived — no extra fetch.
  const chartData = useMemo(() => {
    if (!events || events.length === 0) return [];
    const byDay = new Map<string, { day: string } & Record<TimelineEventType, number>>();
    for (const ev of events) {
      const d = new Date(ev.date);
      const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      if (!byDay.has(key)) {
        byDay.set(key, {
          day: key,
          os_criada: 0,
          os_concluida: 0,
          os_programada: 0,
          material: 0,
        });
      }
      byDay.get(key)![ev.type]++;
    }
    // Sort chronologically (ascending) using the earliest event date per day key
    const dayOrder = new Map<string, number>();
    for (const ev of events) {
      const d = new Date(ev.date);
      const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const ts = d.getTime();
      if (!dayOrder.has(key) || ts < dayOrder.get(key)!) dayOrder.set(key, ts);
    }
    return Array.from(byDay.values()).sort(
      (a, b) => (dayOrder.get(a.day) ?? 0) - (dayOrder.get(b.day) ?? 0)
    );
  }, [events]);

  return (
    <Card className="bg-card border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Linha do Tempo de Eventos</CardTitle>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border/50 p-0.5">
            <Button
              type="button"
              variant={viewMode === "lista" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => setViewMode("lista")}
              title="Ver histórico em lista"
            >
              <List className="w-3.5 h-3.5" />
              Histórico
            </Button>
            <Button
              type="button"
              variant={viewMode === "grafico" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => setViewMode("grafico")}
              title="Ver gráfico da linha do tempo"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Gráfico
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : !events || events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum evento recente para exibir.
          </p>
        ) : viewMode === "lista" ? (
          <div className="relative max-h-[420px] overflow-y-auto pr-1">
            <div className="absolute left-[15px] top-1 bottom-1 w-px bg-border" aria-hidden="true" />
            <ul className="space-y-4">
              {events.map((ev) => {
                const meta = EVENT_META[ev.type] ?? EVENT_META.os_criada;
                const Icon = meta.icon;
                return (
                  <li key={ev.id} className="relative flex gap-3 pl-0">
                    <div className={`relative z-10 shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${meta.bg}`}>
                      <Icon className={`w-4 h-4 ${meta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium truncate">{ev.title}</p>
                        <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                          {formatRelativeDate(ev.date)}
                        </span>
                      </div>
                      {ev.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">{ev.subtitle}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {EVENT_TYPES.map((type) => (
                <Bar
                  key={type}
                  dataKey={type}
                  name={EVENT_META[type].label}
                  stackId="events"
                  fill={EVENT_META[type].hex}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
