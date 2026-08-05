import { ClipboardList, CircleDashed, Clock3, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CalendarSummary {
  total: number;
  abertas: number;
  emAndamento: number;
  concluidas: number;
  canceladas: number;
  atrasadas: number;
}

const CARDS: {
  key: keyof CalendarSummary;
  label: string;
  icon: typeof ClipboardList;
  color: string;
  bg: string;
}[] = [
  { key: "total",       label: "Total de OS",    icon: ClipboardList,   color: "text-foreground",   bg: "bg-muted/40" },
  { key: "abertas",     label: "Abertas",        icon: CircleDashed,    color: "text-slate-400",    bg: "bg-slate-500/10" },
  { key: "emAndamento", label: "Em Andamento",   icon: Clock3,          color: "text-amber-500",    bg: "bg-amber-500/10" },
  { key: "concluidas",  label: "Concluídas",     icon: CheckCircle2,    color: "text-emerald-500",  bg: "bg-emerald-500/10" },
  { key: "canceladas",  label: "Canceladas",     icon: XCircle,         color: "text-red-400",      bg: "bg-red-500/10" },
  { key: "atrasadas",   label: "Atrasadas",      icon: AlertTriangle,   color: "text-red-500",      bg: "bg-red-500/10" },
];

/**
 * Overview cards for the calendar's current month — purely a visual summary
 * derived from the same order list already loaded for the grid. No extra
 * fetch, no new business logic.
 */
export function CalendarSummaryCards({ summary }: { summary: CalendarSummary }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
      {CARDS.map(({ key, label, icon: Icon, color, bg }) => (
        <div
          key={key}
          className="rounded-lg border border-border/50 bg-card px-3 py-2.5 flex items-center gap-2.5 transition-colors hover:border-border"
        >
          <div className={cn("w-8 h-8 rounded-md flex items-center justify-center shrink-0", bg)}>
            <Icon className={cn("w-4 h-4", color)} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground leading-tight truncate">{label}</p>
            <p className={cn("text-lg font-bold leading-tight tabular-nums", color)}>{summary[key]}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
