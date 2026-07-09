import { useLocation, useParams } from "wouter";
import { useState } from "react";
import { format } from "date-fns";
import {
  ArrowLeft, Clock, MapPin, User, Calendar, Save, Trash2, Edit3,
  MessageSquare, Briefcase, CheckCircle2, X, Image, Film, FileText,
  SquarePen,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import {
  useGetServiceOrder,
  useUpdateServiceOrderStatus,
  useUpdateServiceOrder,
  useDeleteServiceOrder,
  useSignServiceOrder,
  getGetServiceOrderQueryKey,
  getListServiceOrdersQueryKey,
  getGetDashboardSummaryQueryKey,
  ServiceOrderStatus,
  ServiceOrderCategory,
  ServiceOrderPriority,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useVibration } from "@/hooks/use-native";
import {
  STATUS_LABELS, STATUS_COLORS, CATEGORY_LABELS, PRIORITY_LABELS,
  PRIORITY_COLORS, TIPO_LABELS, FORMATO_SERVICO_LABELS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

function detectMediaType(src: string): "image" | "video" | "pdf" | "unknown" {
  if (src.startsWith("data:image/")) return "image";
  if (src.startsWith("data:video/")) return "video";
  if (src.startsWith("data:application/pdf")) return "pdf";
  if (/\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(src)) return "image";
  if (/\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(src)) return "video";
  if (/\.pdf(\?|$)/i.test(src)) return "pdf";
  return "image";
}

function MediaThumbnail({
  src,
  onClick,
}: {
  src: string;
  onClick: () => void;
}) {
  const type = detectMediaType(src);
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative rounded-md border border-border overflow-hidden group hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
    >
      {type === "image" && (
        <img src={src} alt="Anexo" className="w-full h-28 md:h-32 object-cover" />
      )}
      {type === "video" && (
        <div className="w-full h-28 md:h-32 flex flex-col items-center justify-center gap-2 bg-muted/40">
          <Film className="w-8 h-8 text-primary" />
          <span className="text-xs text-muted-foreground">Vídeo</span>
        </div>
      )}
      {type === "pdf" && (
        <div className="w-full h-28 md:h-32 flex flex-col items-center justify-center gap-2 bg-muted/40">
          <FileText className="w-8 h-8 text-rose-400" />
          <span className="text-xs text-muted-foreground">PDF</span>
        </div>
      )}
      {type === "unknown" && (
        <div className="w-full h-28 md:h-32 flex flex-col items-center justify-center gap-2 bg-muted/40">
          <Image className="w-8 h-8 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Arquivo</span>
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
        <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium bg-black/60 px-2 py-1 rounded transition-opacity">
          Visualizar
        </span>
      </div>
    </button>
  );
}

function MediaLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const type = detectMediaType(src);
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        onClick={onClose}
        aria-label="Fechar"
      >
        <X className="w-6 h-6" />
      </button>

      {type === "image" && (
        <img
          src={src}
          alt="Anexo"
          className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {type === "video" && (
        <video
          src={src}
          controls
          autoPlay
          className="max-h-[90vh] max-w-full rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {type === "pdf" && (
        <div
          className="bg-card border border-border p-8 rounded-lg text-center space-y-4 max-w-sm w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <FileText className="w-16 h-16 text-rose-400 mx-auto" />
          <p className="text-foreground font-medium">Documento PDF</p>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            download="documento.pdf"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Abrir / Baixar PDF
          </a>
        </div>
      )}
    </div>
  );
}

export default function OSDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { vibrate } = useVibration();

  const { data: os, isLoading } = useGetServiceOrder(id, {
    query: { enabled: !!id, queryKey: getGetServiceOrderQueryKey(id) },
  });

  const updateStatus = useUpdateServiceOrderStatus();
  const updateOs = useUpdateServiceOrder();
  const deleteOs = useDeleteServiceOrder();
  const signOrder = useSignServiceOrder();

  const [statusInput, setStatusInput] = useState<ServiceOrderStatus | "">("");
  const [notesInput, setNotesInput] = useState("");
  const [gestorName, setGestorName] = useState("");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  /* ── Edit mode state ── */
  const [editMode, setEditMode] = useState(false);
  const [editLocation, setEditLocation] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTechnician, setEditTechnician] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const enterEditMode = () => {
    if (!os) return;
    setEditLocation(os.location ?? "");
    setEditDescription(os.description ?? "");
    setEditTechnician(os.technicianName ?? "");
    setEditNotes(os.notes ?? "");
    setEditMode(true);
  };

  const handleSaveEdit = () => {
    updateOs.mutate(
      {
        id,
        data: {
          location: editLocation || undefined,
          description: editDescription || undefined,
          technicianName: editTechnician || undefined,
          notes: editNotes || undefined,
        } as any,
      },
      {
        onSuccess: () => {
          toast({ title: "OS Atualizada", description: "As alterações foram salvas." });
          queryClient.invalidateQueries({ queryKey: getGetServiceOrderQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListServiceOrdersQueryKey() });
          setEditMode(false);
          vibrate([100, 50, 100]);
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível salvar as alterações.", variant: "destructive" });
        },
      }
    );
  };

  const handleUpdateStatus = () => {
    if (!statusInput) return;
    updateStatus.mutate(
      { id, data: { status: statusInput as ServiceOrderStatus, notes: notesInput } },
      {
        onSuccess: () => {
          toast({ title: "Status Atualizado", description: "O status da OS foi atualizado." });
          queryClient.invalidateQueries({ queryKey: getGetServiceOrderQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListServiceOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setStatusInput("");
          setNotesInput("");
          vibrate(200);
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível atualizar o status.", variant: "destructive" });
        },
      }
    );
  };

  const handleSign = () => {
    if (!gestorName.trim()) return;
    signOrder.mutate(
      { id, data: { signedBy: gestorName } },
      {
        onSuccess: () => {
          toast({ title: "OS Encerrada", description: "Ordem de serviço assinada e concluída." });
          queryClient.invalidateQueries({ queryKey: getGetServiceOrderQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListServiceOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setGestorName("");
          vibrate([100, 100, 300]);
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível assinar a OS.", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = () => {
    if (confirm("Tem certeza que deseja excluir esta OS? Esta ação não pode ser desfeita.")) {
      deleteOs.mutate(
        { id },
        {
          onSuccess: () => {
            toast({ title: "OS Excluída", description: "Ordem de serviço removida." });
            queryClient.invalidateQueries({ queryKey: getListServiceOrdersQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
            setLocation("/ordens");
          },
        }
      );
    }
  };

  const formatCurrency = (val?: number) => {
    if (val == null) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!os) return <div className="p-8">OS não encontrada.</div>;

  // Filter out video data-URLs and entries > 2 MB to prevent OOM crashes in browser.
  const MAX_DISPLAY_CHARS = 2 * 1024 * 1024;
  let photos: string[] = [];
  try {
    if (os.photos) {
      const parsed: unknown[] = JSON.parse(os.photos);
      photos = parsed.filter(
        (s): s is string =>
          typeof s === "string" &&
          !s.startsWith("data:video/") &&
          s.length <= MAX_DISPLAY_CHARS
      );
    }
  } catch {}

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* ── Media Lightbox ── */}
      {lightboxSrc && (
        <MediaLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/ordens")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-mono text-primary">{os.number}</h1>
              <Badge variant="outline" className={STATUS_COLORS[os.status as ServiceOrderStatus]}>
                {STATUS_LABELS[os.status as ServiceOrderStatus]}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-lg">{os.title}</p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto flex-wrap">
          {!editMode && (
            <Button variant="outline" onClick={enterEditMode} className="gap-2">
              <SquarePen className="w-4 h-4" />
              Editar OS
            </Button>
          )}
          <Button
            variant="outline"
            className="text-destructive border-destructive hover:bg-destructive/10"
            onClick={handleDelete}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* ── Main Details Card ── */}
          <Card className="bg-card border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg">
                {editMode ? "Editando OS" : "Detalhes do Serviço"}
              </CardTitle>
              {editMode && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditMode(false)}>
                    <X className="w-4 h-4 mr-1" />
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={updateOs.isPending}
                    className="gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {updateOs.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {editMode ? (
                /* ── Edit Form ── */
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-muted-foreground" /> Local
                    </label>
                    <Input
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      placeholder="Local do serviço"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <User className="w-4 h-4 text-muted-foreground" /> Técnico Responsável
                    </label>
                    <Input
                      value={editTechnician}
                      onChange={(e) => setEditTechnician(e.target.value)}
                      placeholder="Nome do técnico"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Descrição</label>
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Descrição detalhada do serviço..."
                      className="min-h-[100px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" /> Notas e Andamento
                    </label>
                    <Textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Observações, progresso, materiais usados..."
                      className="min-h-[80px]"
                    />
                  </div>
                </div>
              ) : (
                /* ── View Mode ── */
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" /> Local
                      </div>
                      <div className="font-medium">{os.location}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4" /> Departamento
                      </div>
                      <div className="font-medium">{os.department || "-"}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <User className="w-4 h-4" /> Técnico
                      </div>
                      <div className="font-medium">
                        {os.technicianName || (
                          <span className="text-muted-foreground italic">Não atribuído</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" /> Programado para
                      </div>
                      <div className="font-medium">
                        {os.scheduledAt ? format(new Date(os.scheduledAt), "dd/MM/yyyy") : "-"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Clock className="w-4 h-4" /> Criado em
                      </div>
                      <div className="font-medium">
                        {format(new Date(os.createdAt), "dd/MM/yyyy HH:mm")}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Valor Estimado</div>
                      <div className="font-medium font-mono text-amber-500">
                        {formatCurrency(os.estimatedValue ?? undefined)}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/50">
                    <div className="text-sm text-muted-foreground mb-2">Descrição</div>
                    <p className="whitespace-pre-wrap">
                      {os.description || "Nenhuma descrição detalhada."}
                    </p>
                  </div>

                  {os.notes && (
                    <div className="pt-4 border-t border-border/50">
                      <div className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4" /> Notas e Andamento
                      </div>
                      <p className="whitespace-pre-wrap text-amber-500/90">{os.notes}</p>
                    </div>
                  )}
                </>
              )}

              {/* ── Attachments (always visible) ── */}
              {photos.length > 0 && (
                <div className={cn("pt-4 border-t border-border/50", editMode && "mt-4")}>
                  <div className="text-sm text-muted-foreground mb-4 flex items-center gap-1.5">
                    <Image className="w-4 h-4" />
                    Anexos ({photos.length})
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {photos.map((src, i) => (
                      <MediaThumbnail
                        key={i}
                        src={src}
                        onClick={() => setLightboxSrc(src)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Manager Signature ── */}
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Encerramento pelo Gestor</CardTitle>
            </CardHeader>
            <CardContent>
              {os.signedBy ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-md flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-emerald-500">OS Encerrada e Assinada</h4>
                    <p className="text-sm text-emerald-500/80 mt-1">
                      Assinada por: <strong>{os.signedBy}</strong>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nome do Gestor</label>
                    <Input
                      placeholder="Seu nome completo"
                      value={gestorName}
                      onChange={(e) => setGestorName(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleSign}
                    disabled={!gestorName.trim() || signOrder.isPending}
                  >
                    {signOrder.isPending ? "Assinando..." : "Assinar e Concluir OS"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-6">
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Classificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Categoria</div>
                <Badge variant="secondary" className="text-sm">
                  {CATEGORY_LABELS[os.category as ServiceOrderCategory]}
                </Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Tipo de Serviço</div>
                <div className="font-medium">{os.tipo ? TIPO_LABELS[os.tipo] : "-"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Formato</div>
                <div className="font-medium">
                  {os.formatoServico ? FORMATO_SERVICO_LABELS[os.formatoServico] : "-"}
                </div>
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
              <Select
                value={statusInput}
                onValueChange={(v) => setStatusInput(v as ServiceOrderStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Novo Status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val} disabled={val === os.status}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
