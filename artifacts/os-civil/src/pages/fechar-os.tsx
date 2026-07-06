import { useState, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { format } from "date-fns";
import { ArrowLeft, MapPin, ClipboardList, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UNITS, type Unit } from "@/contexts/unit-context";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS } from "@/lib/constants";
import type { ServiceOrderStatus, ServiceOrderPriority } from "@workspace/api-client-react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type OS = {
  id: number;
  number: string;
  title: string;
  location: string;
  status: string;
  priority: string;
  technicianName?: string | null;
  createdAt: string;
};

export default function FecharOS() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const params = new URLSearchParams(search);
  const unitFromUrl = (params.get("u") || "AM") as Unit;
  const unitInfo = UNITS.find(u => u.key === unitFromUrl) || UNITS[0];

  const [ordens, setOrdens] = useState<OS[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);

  // Load OS on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/service-orders?unidade=${unitFromUrl}`);
        if (!cancelled && res.ok) setOrdens(await res.json());
      } catch {
        if (!cancelled) toast({ title: "Erro ao carregar ordens", variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [unitFromUrl]);

  const handleStatusChange = async (id: number, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`${BASE_URL}/api/service-orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      setOrdens(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
      setSuccessId(id);
      setTimeout(() => setSuccessId(null), 2000);
      toast({ title: "Status atualizado!" });
    } catch {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const goBack = () => setLocation(`/registrar?u=${unitFromUrl}`);

  return (
    <div className="min-h-screen bg-background text-foreground dark flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-3 flex items-center gap-4 shrink-0">
        <img src="/logo-amazonica.png" alt="Logo Rede Amazônica" className="h-10 w-10 object-contain" />
        <div className="border-l border-border pl-4">
          <div className="font-bold text-sm leading-tight">Grupo Rede Amazônica</div>
          <div className="text-xs text-muted-foreground">Departamento: Operações</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            <span>Unidade</span>
            <Badge variant="outline" className="font-mono text-primary border-primary/50 text-xs px-2">
              {unitFromUrl}
            </Badge>
            <span className="hidden sm:inline text-muted-foreground/60">— {unitInfo.name}</span>
          </div>
          <button
            onClick={goBack}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Menu
          </button>
        </div>
      </header>

      <div className="flex-1 px-4 py-8 max-w-3xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-red-500" />
            Fechar Ordem de Serviço
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Selecione o status de encerramento da OS. Apenas o campo <strong>Status</strong> pode ser alterado.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Carregando ordens...
          </div>
        ) : ordens.length === 0 ? (
          <Card className="bg-card border-border/50">
            <CardContent className="p-10 text-center text-muted-foreground">
              Nenhuma ordem de serviço encontrada para a unidade {unitFromUrl}.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {ordens.map(os => (
              <Card key={os.id} className={`bg-card border-border/50 transition-all ${successId === os.id ? "border-emerald-500/50 bg-emerald-500/5" : ""}`}>
                <CardContent className="p-4 space-y-3">
                  {/* OS header */}
                  <div className="flex flex-wrap items-start gap-2 justify-between">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-primary text-sm">{os.number}</span>
                        <span className="text-sm text-muted-foreground">—</span>
                        <span className="font-medium text-sm truncate">{os.title}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Local: {os.location} · {os.technicianName ? `Técnico: ${os.technicianName}` : "Sem técnico"} · {format(new Date(os.createdAt), "dd/MM/yyyy")}
                      </div>
                    </div>
                    {successId === os.id && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    )}
                  </div>

                  {/* Read-only fields */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={PRIORITY_COLORS[os.priority as ServiceOrderPriority] ?? ""}>
                      {PRIORITY_LABELS[os.priority as ServiceOrderPriority] || os.priority}
                    </Badge>
                  </div>

                  {/* Editable status */}
                  <div className="flex items-center gap-3 pt-1 border-t border-border/40">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-14 shrink-0">Status</span>
                    <div className="flex-1 max-w-[220px]">
                      <Select
                        value={os.status}
                        onValueChange={(val) => handleStatusChange(os.id, val)}
                        disabled={updatingId === os.id}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          {updatingId === os.id ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Salvando...
                            </div>
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([val, label]) => (
                            <SelectItem key={val} value={val}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Badge variant="outline" className={STATUS_COLORS[os.status as ServiceOrderStatus] ?? ""}>
                      {STATUS_LABELS[os.status as ServiceOrderStatus] || os.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
