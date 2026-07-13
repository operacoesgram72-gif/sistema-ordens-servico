import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardPlus, CheckCircle2, CalendarClock, Package, History } from "lucide-react";
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
const EVENT_META: Record<TimelineEventType, { icon: typeof ClipboardPlus; color: string; bg: string }> = {
  os_criada:     { icon: ClipboardPlus,  color: "text-primary",       bg: "bg-primary/10" },
  os_concluida:  { icon: CheckCircle2,   color: "text-emerald-500",   bg: "bg-emerald-500/10" },
  os_programada: { icon: CalendarClock,  color: "text-blue-400",      bg: "bg-blue-400/10" },
  material:      { icon: Package,        color: "text-amber-500",     bg: "bg-amber-500/10" },
};

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
    // Future event (e.g. scheduled OS) — show absolute date, no relative label.
    return `${dateStr} às ${time}`;
  }
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffH < 24) return `há ${diffH}h`;
  if (diffD < 7) return `há ${diffD}d`;
  return `${dateStr} às ${time}`;
}

/**
 * Timeline of recent events for the Indicadores screen.
 * Purely additive widget — reads from GET /api/dashboard/timeline (read-only
 * aggregation endpoint) and renders as a standalone Card. Does not alter,
 * wrap, or depend on any other section of the page.
 */
export default function IndicadoresTimeline() {
  const { unit } = useUnit();

  const { data: events, isLoading } = useQuery<TimelineEvent[]>({
    queryKey: ["dashboard-timeline", unit],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/dashboard/timeline?unidade=${unit}&limit=25`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <Card className="bg-card border-border/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-base">Linha do Tempo de Eventos</CardTitle>
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
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}
