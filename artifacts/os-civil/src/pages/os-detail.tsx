import { useLocation, useParams } from "wouter";
import { useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Clock, MapPin, User, Calendar, Save, Trash2, Edit3, MessageSquare } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { 
  useGetServiceOrder, 
  useUpdateServiceOrderStatus, 
  useDeleteServiceOrder,
  getGetServiceOrderQueryKey,
  getListServiceOrdersQueryKey,
  getGetDashboardSummaryQueryKey,
  ServiceOrderStatus,
  ServiceOrderCategory,
  ServiceOrderPriority
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { STATUS_LABELS, STATUS_COLORS, CATEGORY_LABELS, PRIORITY_LABELS, PRIORITY_COLORS } from "@/lib/constants";

export default function OSDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: os, isLoading } = useGetServiceOrder(id, { 
    query: { enabled: !!id, queryKey: getGetServiceOrderQueryKey(id) } 
  });

  const updateStatus = useUpdateServiceOrderStatus();
  const deleteOs = useDeleteServiceOrder();

  const [statusInput, setStatusInput] = useState<ServiceOrderStatus | "">("");
  const [notesInput, setNotesInput] = useState("");

  const handleUpdateStatus = () => {
    if (!statusInput) return;
    updateStatus.mutate({ id, data: { status: statusInput as ServiceOrderStatus, notes: notesInput } }, {
      onSuccess: () => {
        toast({ title: "Status Atualizado", description: "O status da OS foi atualizado." });
        queryClient.invalidateQueries({ queryKey: getGetServiceOrderQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListServiceOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setStatusInput("");
        setNotesInput("");
      },
      onError: () => {
        toast({ title: "Erro", description: "Não foi possível atualizar o status.", variant: "destructive" });
      }
    });
  };

  const handleDelete = () => {
    if (confirm("Tem certeza que deseja excluir esta OS? Esta ação não pode ser desfeita.")) {
      deleteOs.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "OS Excluída", description: "Ordem de serviço removida." });
          queryClient.invalidateQueries({ queryKey: getListServiceOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setLocation("/ordens");
        }
      });
    }
  };

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (!os) return <div className="p-8">OS não encontrada.</div>;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/ordens")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-mono text-primary">{os.number}</h1>
              <Badge variant="outline" className={STATUS_COLORS[os.status as ServiceOrderStatus]}>
                {STATUS_LABELS[os.status as ServiceOrderStatus]}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-lg">{os.title}</p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Detalhes do Serviço</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Local</div>
                  <div className="font-medium">{os.location}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5"><User className="w-4 h-4" /> Técnico</div>
                  <div className="font-medium">{os.technicianName || <span className="text-muted-foreground italic">Não atribuído</span>}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Programado para</div>
                  <div className="font-medium">{os.scheduledAt ? format(new Date(os.scheduledAt), "dd/MM/yyyy") : "-"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5"><Clock className="w-4 h-4" /> Criado em</div>
                  <div className="font-medium">{format(new Date(os.createdAt), "dd/MM/yyyy HH:mm")}</div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/50">
                <div className="text-sm text-muted-foreground mb-2">Descrição</div>
                <p className="whitespace-pre-wrap">{os.description || "Nenhuma descrição detalhada."}</p>
              </div>
              
              {os.notes && (
                <div className="pt-4 border-t border-border/50">
                  <div className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5"><MessageSquare className="w-4 h-4" /> Notas e Andamento</div>
                  <p className="whitespace-pre-wrap text-amber-500/90">{os.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Classificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Categoria</div>
                <Badge variant="secondary" className="text-sm">{CATEGORY_LABELS[os.category as ServiceOrderCategory]}</Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Prioridade</div>
                <Badge variant="outline" className={PRIORITY_COLORS[os.priority as ServiceOrderPriority]}>
                  {PRIORITY_LABELS[os.priority as ServiceOrderPriority]}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Atualizar Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Select value={statusInput} onValueChange={(v) => setStatusInput(v as ServiceOrderStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Novo Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val} disabled={val === os.status}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {statusInput && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Textarea 
                    placeholder="Adicionar nota ou justificativa..." 
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <Button 
                    className="w-full" 
                    onClick={handleUpdateStatus}
                    disabled={updateStatus.isPending}
                  >
                    {updateStatus.isPending ? "Atualizando..." : "Confirmar Alteração"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
