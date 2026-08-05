import { AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_LABELS } from "@/lib/constants";
import { PriorityIcon } from "./priority-icon";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const STATUS_DOT: Record<string, string> = {
  aberta: "bg-slate-400",
  em_andamento: "bg-amber-500",
  concluida: "bg-emerald-500",
  cancelada: "bg-red-400",
};

/** Order shape used across the calendar — matches the enriched list response. */
export interface CalendarOrder {
  id: number | string;
  number: string;
  title: string;
  status: string;
  priority?: string | null;
  location?: string | null;
  department?: string | null;
  technicianName?: string | null;
  scheduledAt?: string | null;
  createdAt?: string | null;
}

export function isOverdue(os: CalendarOrder): boolean {
  if (!os.scheduledAt) return false;
  if (os.status === "concluida" || os.status === "cancelada") return false;
  return new Date(os.scheduledAt).getTime() < Date.now();
}

/**
 * A single OS entry rendered as a compact chip — used both inside a day cell
 * and inside the day-expansion list. Shows status color, priority icon, an
 * overdue marker, and a hover tooltip with a quick summary.
 */
export function OrderChip({
  os,
  onClick,
  dense = false,
}: {
  os: CalendarOrder;
  onClick: (e: React.MouseEvent) => void;
  dense?: boolean;
}) {
  const overdue = isOverdue(os);
  const dateLabel = os.scheduledAt
    ? `Agendado: ${format(new Date(os.scheduledAt), "dd/MM/yyyy 'às' HH:mm")}`
    : os.createdAt
    ? `Criado: ${format(new Date(os.createdAt), "dd/MM/yyyy")}`
    : null;

  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "w-full text-left flex items-center gap-1 px-1 py-0.5 rounded transition-colors group",
            dense ? "text-[10px]" : "text-xs",
            "hover:bg-muted/60"
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[os.status] || "bg-muted")} />
          <span className="truncate text-foreground/80 group-hover:text-primary leading-tight flex-1">
            {os.number}
          </span>
          {os.priority && <PriorityIcon priority={os.priority} className="w-2.5 h-2.5 shrink-0" />}
          {overdue && <AlertTriangle className="w-2.5 h-2.5 text-red-500 shrink-0" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[240px] space-y-1 bg-popover text-popover-foreground border border-border">
        <p className="font-semibold text-xs">{os.number} — {os.title}</p>
        {os.location && <p className="text-[11px] text-muted-foreground">Local: {os.location}</p>}
        <p className="text-[11px] text-muted-foreground">
          Responsável: {os.technicianName || "Não atribuído"}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Status: {STATUS_LABELS[os.status as keyof typeof STATUS_LABELS] || os.status}
        </p>
        {os.priority && (
          <p className="text-[11px] text-muted-foreground">
            Prioridade: {PRIORITY_LABELS[os.priority as keyof typeof PRIORITY_LABELS] || os.priority}
          </p>
        )}
        {dateLabel && <p className="text-[11px] text-muted-foreground">{dateLabel}</p>}
        {overdue && <p className="text-[11px] text-red-400 font-medium">⚠ Atrasada</p>}
      </TooltipContent>
    </Tooltip>
  );
}

export { STATUS_COLORS, STATUS_DOT };
