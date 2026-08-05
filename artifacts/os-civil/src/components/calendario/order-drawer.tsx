import { AlertTriangle, ArrowUpRight, Calendar, MapPin, User, Building2 } from "lucide-react";
import { format } from "date-fns";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/constants";
import { PriorityIcon } from "./priority-icon";
import { isOverdue, type CalendarOrder } from "./order-chip";
import { cn } from "@/lib/utils";

/**
 * Side panel (Drawer) with a quick summary of an OS and its available
 * actions. Purely a presentational layer — the only action is navigating to
 * the existing full OS page (/ordens/:id), same route used before. No new
 * business logic or API calls are introduced.
 */
export function OrderDetailsDrawer({
  order,
  open,
  onOpenChange,
  onOpenFull,
  readOnly,
}: {
  order: CalendarOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenFull: (id: number | string) => void;
  readOnly: boolean;
}) {
  const overdue = order ? isOverdue(order) : false;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        {order && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "text-[11px] font-medium px-2 py-0.5 rounded-full border",
                    STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] || "bg-muted/50 text-muted-foreground border-border"
                  )}
                >
                  {STATUS_LABELS[order.status as keyof typeof STATUS_LABELS] || order.status}
                </span>
                {order.priority && (
                  <span
                    className={cn(
                      "text-[11px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1",
                      PRIORITY_COLORS[order.priority as keyof typeof PRIORITY_COLORS] || "bg-muted/50 text-muted-foreground border-border"
                    )}
                  >
                    <PriorityIcon priority={order.priority} className="w-3 h-3" />
                    {PRIORITY_LABELS[order.priority as keyof typeof PRIORITY_LABELS] || order.priority}
                  </span>
                )}
                {overdue && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-red-500/10 text-red-400 border-red-500/30 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Atrasada
                  </span>
                )}
              </div>
              <SheetTitle className="text-left">{order.title}</SheetTitle>
              <SheetDescription className="text-left">{order.number}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto space-y-3 mt-2 text-sm">
              {order.location && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Local</p>
                    <p className="text-foreground">{order.location}</p>
                  </div>
                </div>
              )}
              {order.department && (
                <div className="flex items-start gap-2.5">
                  <Building2 className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Departamento</p>
                    <p className="text-foreground">{order.department}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2.5">
                <User className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Responsável</p>
                  <p className="text-foreground">{order.technicianName || "Não atribuído"}</p>
                </div>
              </div>
              {(order.scheduledAt || order.createdAt) && (
                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {order.scheduledAt ? "Agendado para" : "Criado em"}
                    </p>
                    <p className="text-foreground">
                      {format(new Date((order.scheduledAt || order.createdAt)!), "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <SheetFooter>
              {!readOnly && (
                <Button onClick={() => onOpenFull(order.id)} className="gap-2 w-full sm:w-auto">
                  Abrir OS completa
                  <ArrowUpRight className="w-4 h-4" />
                </Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
