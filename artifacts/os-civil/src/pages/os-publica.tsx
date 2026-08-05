/**
 * Página pública de visualização de OS — sem portal, sem navegação, somente leitura.
 * Acessível via link compartilhado: /os-publica/:id
 * Não depende de UnitProvider, AppLayout ou autenticação.
 */
import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  MapPin, User, Calendar, Clock, Briefcase, MessageSquare,
  CheckCircle2, X, Image, Film, FileText, AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  STATUS_LABELS, STATUS_COLORS,
  CATEGORY_LABELS, PRIORITY_LABELS, PRIORITY_COLORS,
  TIPO_LABELS, FORMATO_SERVICO_LABELS,
} from "@/lib/constants";
import type { ServiceOrderStatus, ServiceOrderCategory, ServiceOrderPriority } from "@workspace/api-client-react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

function detectMediaType(src: string): "image" | "video" | "pdf" | "unknown" {
  if (src.startsWith("data:image/")) return "image";
  if (src.startsWith("data:video/")) return "video";
  if (src.startsWith("data:application/pdf")) return "pdf";
  if (/\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(src)) return "image";
  if (/\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(src)) return "video";
  if (/\.pdf(\?|$)/i.test(src)) return "pdf";
  return "image";
}

function MediaThumbnail({ src, onClick }: { src: string; onClick: () => void }) {
  const type = detectMediaType(src);
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative rounded-md border border-border overflow-hidden group hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary w-full"
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
        <img src={src} alt="Anexo" className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl" onClick={e => e.stopPropagation()} />
      )}
      {type === "video" && (
        <video src={src} controls autoPlay className="max-h-[90vh] max-w-full rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
      )}
      {type === "pdf" && (
        <div className="bg-card border border-border p-8 rounded-lg text-center space-y-4 max-w-sm w-full" onClick={e => e.stopPropagation()}>
          <FileText className="w-16 h-16 text-rose-400 mx-auto" />
          <p className="text-foreground font-medium">Documento PDF</p>
          <a href={src} target="_blank" rel="noopener noreferrer" download="documento.pdf"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
            <FileText className="w-4 h-4" /> Abrir / Baixar PDF
          </a>
        </div>
      )}
    </div>
  );
}

function formatCurrency(val?: number | null) {
  if (val == null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

type OS = {
  id: number; number: string; title: string; status: string; location: string;
  department?: string | null; technicianName?: string | null; description?: string | null;
  notes?: string | null; photos?: string | null; signature?: string | null;
  signedBy?: string | null; signedAt?: string | null; createdAt: string;
  scheduledAt?: string | null; completedAt?: string | null;
  estimatedValue?: number | null; category: string; tipo?: string | null;
  formatoServico?: string | null; priority: string;
};

export default function OsPublica() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const { data: os, isLoading, isError } = useQuery<OS>({
    queryKey: ["os-publica", token],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/shared-os/${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error("OS não encontrada");
      return res.json() as Promise<OS>;
    },
    enabled: token.length > 10,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const MAX_DISPLAY_CHARS = 2 * 1024 * 1024;
  let photos: string[] = [];
  if (os?.photos) {
    try {
      const parsed: unknown[] = JSON.parse(os.photos);
      photos = parsed.filter(
        (s): s is string =>
          typeof s === "string" &&
          !s.startsWith("data:video/") &&
          s.length <= MAX_DISPLAY_CHARS
      );
    } catch {}
  }

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      {lightboxSrc && <MediaLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      {/* Minimal header — branding only, no navigation */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={`${BASE_URL}/logo-amazonica.png`} alt="Logo" className="h-8 w-8 object-contain opacity-80" />
            <span className="text-sm font-semibold text-muted-foreground">Ordem de Serviço</span>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
            Somente Leitura
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-6">
        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <AlertCircle className="w-12 h-12 text-destructive opacity-60" />
            <h2 className="text-xl font-semibold">OS não encontrada</h2>
            <p className="text-muted-foreground text-sm max-w-xs">
              O link pode estar incorreto ou a ordem de serviço foi removida.
            </p>
          </div>
        )}

        {os && (
          <>
            {/* ── Header da OS ── */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-mono text-primary">
                  {os.number}
                </h1>
                <Badge variant="outline" className={cn(STATUS_COLORS[os.status as ServiceOrderStatus])}>
                  {STATUS_LABELS[os.status as ServiceOrderStatus] ?? os.status}
                </Badge>
              </div>
              <p className="text-muted-foreground text-lg">{os.title}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">

                {/* ── Detalhes do Serviço ── */}
                <Card className="bg-card border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Detalhes do Serviço</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
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
                          {os.technicianName || <span className="text-muted-foreground italic">Não atribuído</span>}
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
                          {formatCurrency(os.estimatedValue)}
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

                    {/* ── Anexos / Fotos ── */}
                    <div className="pt-4 border-t border-border/50">
                      <div className="text-sm text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Image className="w-4 h-4" />
                        Anexos {photos.length > 0 && `(${photos.length})`}
                      </div>
                      {photos.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {photos.map((src, i) => (
                            <MediaThumbnail key={i} src={src} onClick={() => setLightboxSrc(src)} />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground/60 italic py-2">
                          Nenhum anexo registrado.
                        </p>
                      )}
                    </div>

                    {/* ── Assinatura de encerramento ── */}
                    {os.signedBy && (
                      <div className="pt-4 border-t border-border/50">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-md flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                          <div>
                            <h4 className="font-medium text-emerald-500">OS Encerrada e Assinada</h4>
                            <p className="text-sm text-emerald-500/80 mt-1">
                              Assinada por: <strong>{os.signedBy}</strong>
                              {os.signedAt && (
                                <> · {format(new Date(os.signedAt), "dd/MM/yyyy HH:mm")}</>
                              )}
                            </p>
                          </div>
                        </div>
                        {os.signature && (
                          <div className="mt-3">
                            <div className="text-xs text-muted-foreground mb-1">Assinatura Digital</div>
                            <img
                              src={os.signature}
                              alt="Assinatura"
                              className="h-20 bg-white rounded border border-border object-contain"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* ── Sidebar: Classificação ── */}
              <div>
                <Card className="bg-card border-border/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Classificação</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Categoria</div>
                      <Badge variant="secondary" className="text-sm">
                        {CATEGORY_LABELS[os.category as ServiceOrderCategory] ?? os.category}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Tipo de Serviço</div>
                      <div className="font-medium">{os.tipo ? TIPO_LABELS[os.tipo] : "-"}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Formato</div>
                      <div className="font-medium">
                        {os.formatoServico ? (FORMATO_SERVICO_LABELS[os.formatoServico] ?? os.formatoServico) : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Prioridade</div>
                      <Badge variant="outline" className={cn(PRIORITY_COLORS[os.priority as ServiceOrderPriority])}>
                        {PRIORITY_LABELS[os.priority as ServiceOrderPriority] ?? os.priority}
                      </Badge>
                    </div>
                    {os.completedAt && (
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Concluído em</div>
                        <div className="font-medium text-emerald-500">
                          {format(new Date(os.completedAt), "dd/MM/yyyy")}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground/40 pb-8 pt-4">
              GRAM Operações — Grupo Rede Amazônica
            </div>
          </>
        )}
      </main>
    </div>
  );
}
