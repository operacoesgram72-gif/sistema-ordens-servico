import { useState, useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Download, Plus, Search, FileSpreadsheet, Camera, FileText, RefreshCw } from "lucide-react";
import { 
  useListServiceOrders, 
  ServiceOrderStatus, 
  ServiceOrderPriority 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, TIPO_LABELS, FORMATO_SERVICO_LABELS } from "@/lib/constants";
import { useUnit } from "@/contexts/unit-context";
import { generatePDF } from "@/lib/pdf-utils";

type HoveredPhoto = { src: string; x: number; y: number } | null;
type LightboxState = { photos: string[]; index: number } | null;

// Max size for a display data URL (~2 MB base64 ≈ 1.5 MB image).
// Entries exceeding this or containing video data are skipped to prevent OOM crashes.
const MAX_DISPLAY_CHARS = 2 * 1024 * 1024;
function parsePhotos(photosStr: string | null | undefined): string[] {
  if (!photosStr) return [];
  try {
    const arr: unknown[] = JSON.parse(photosStr);
    return arr.filter(
      (s): s is string =>
        typeof s === "string" &&
        !s.startsWith("data:video/") &&
        s.length <= MAX_DISPLAY_CHARS
    );
  } catch { return []; }
}

const formatCurrency = (val?: number) => {
  if (val == null) return "—";
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

export default function Ordens() {
  const [, setLocation] = useLocation();
  const { unit } = useUnit();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [period, setPeriod] = useState<string>("monthly");
  const [tipo, setTipo] = useState<string>("all");
  const [formato, setFormato] = useState<string>("all");
  const [hoveredPhoto, setHoveredPhoto] = useState<HoveredPhoto>(null);
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Lazy-load first photo per OS for the list thumbnail.
  // Photos are excluded from the list payload for performance; when the user
  // hovers over a row with photos, we fetch from the lightweight /photos endpoint
  // and cache the result so subsequent hovers are instant.
  const [loadedPhotos, setLoadedPhotos] = useState<Record<number, string>>({});
  const loadingPhotosRef = useRef(new Set<number>());
  const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

  const loadFirstPhoto = useCallback(async (id: number) => {
    if (loadedPhotos[id] || loadingPhotosRef.current.has(id)) return;
    loadingPhotosRef.current.add(id);
    try {
      const res = await fetch(`${BASE_URL}/api/service-orders/${id}/photos`);
      if (!res.ok) return;
      const { photos: raw } = await res.json() as { photos: string | null };
      if (!raw) return;
      const arr: unknown[] = JSON.parse(raw);
      const MAX_THUMB = 500 * 1024; // 500 KB — enough for a clear thumbnail
      const first = arr.find(
        (s): s is string =>
          typeof s === "string" &&
          s.startsWith("data:image/") &&
          s.length <= MAX_THUMB
      );
      if (first) setLoadedPhotos(prev => ({ ...prev, [id]: first }));
    } catch {
      // silently ignore — camera icon stays, user can open detail page
    } finally {
      loadingPhotosRef.current.delete(id);
    }
  }, [loadedPhotos, BASE_URL]);

  // Stable key — prevents handleRefresh from re-creating on every render
  const queryKey = useMemo(
    () => ["service-orders", search, status, period, tipo, formato, unit],
    [search, status, period, tipo, formato, unit]
  );

  const { data: ordens, isLoading } = useListServiceOrders(
    {
      search: search || undefined,
      status: status !== "all" ? status : undefined,
      period: period !== "all" ? (period as any) : undefined,
      tipo: tipo !== "all" ? (tipo as any) : undefined,
      formatoServico: formato !== "all" ? (formato as any) : undefined,
      unidade: unit,
    } as any,
    { query: { enabled: true, queryKey } }
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey });
    setRefreshing(false);
  }, [queryClient, queryKey]);

  const exportToExcel = () => {
    if (!ordens || ordens.length === 0) return;
    const headers = ["Data", "UF", "Número", "Título / Local", "Tipo", "Formato", "Status", "Prioridade", "Técnico", "Valor Estimado"];
    const content = [
      headers.join("\t"),
      ...ordens.map(os => [
        format(new Date(os.createdAt), "dd/MM/yyyy"),
        (os as any).unidade || "—",
        os.number,
        `${os.title} - ${os.location}`.replace(/\t/g, ' '),
        os.tipo ? TIPO_LABELS[os.tipo] : "—",
        os.formatoServico ? FORMATO_SERVICO_LABELS[os.formatoServico] : "—",
        STATUS_LABELS[os.status as ServiceOrderStatus] || os.status,
        PRIORITY_LABELS[os.priority as ServiceOrderPriority] || os.priority,
        (os.technicianName || "Não atribuído"),
        os.estimatedValue || 0,
      ].join("\t"))
    ].join("\n");
    const blob = new Blob(["\uFEFF" + content], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ordens-servico-${format(new Date(), "yyyy-MM-dd")}.xls`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleExportPDF = () => {
    if (!ordens || ordens.length === 0) return;
    generatePDF({
      title: "Lista de Ordens de Serviço",
      subtitle: "Chamados e atividades de manutenção",
      unit,
      columns: [
        { header: "Data", key: "data", width: "9%" },
        { header: "UF", key: "uf", width: "5%" },
        { header: "Número", key: "numero", width: "9%" },
        { header: "Título / Local", key: "titulo", width: "20%" },
        { header: "Tipo", key: "tipo", width: "9%" },
        { header: "Formato", key: "formato", width: "11%" },
        { header: "Status", key: "status", width: "9%" },
        { header: "Prioridade", key: "prioridade", width: "9%" },
        { header: "Técnico", key: "tecnico", width: "11%" },
        { header: "Valor Est.", key: "valor", width: "8%" },
      ],
      rows: ordens.map(os => ({
        data: format(new Date(os.createdAt), "dd/MM/yyyy"),
        uf: (os as any).unidade || "—",
        numero: os.number,
        titulo: `${os.title} — ${os.location}`,
        tipo: os.tipo ? TIPO_LABELS[os.tipo] : "—",
        formato: os.formatoServico ? FORMATO_SERVICO_LABELS[os.formatoServico] : "—",
        status: STATUS_LABELS[os.status as ServiceOrderStatus] || os.status,
        prioridade: PRIORITY_LABELS[os.priority as ServiceOrderPriority] || os.priority,
        tecnico: os.technicianName || "—",
        valor: formatCurrency(os.estimatedValue ?? undefined),
      })),
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print-hide">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ordens de Serviço</h1>
          <p className="text-muted-foreground mt-1">Unidade: <strong>{unit}</strong> — chamados e atividades.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2" title="Atualizar lista">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" onClick={handleExportPDF} disabled={!ordens?.length}>
            <FileText className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
          <Button variant="outline" onClick={exportToExcel} disabled={!ordens?.length}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
          <Button onClick={() => setLocation("/ordens/nova")}>
            <Plus className="w-4 h-4 mr-2" />
            Nova OS
          </Button>
        </div>
      </div>

      <Card className="p-4 bg-card border-border/50 print-hide">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar (número, título)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue placeholder="Tipo de Serviço" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              {Object.entries(TIPO_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={formato} onValueChange={setFormato}>
            <SelectTrigger><SelectValue placeholder="Formato" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Formatos</SelectItem>
              {Object.entries(FORMATO_SERVICO_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="daily">Hoje</SelectItem>
              <SelectItem value="monthly">Este Mês</SelectItem>
              <SelectItem value="annual">Este Ano</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Photo hover preview */}
      {hoveredPhoto && (
        <div style={{ position: "fixed", left: hoveredPhoto.x + 14, top: Math.max(8, hoveredPhoto.y - 130), zIndex: 9999, pointerEvents: "none" }}>
          <img src={hoveredPhoto.src} alt="Preview" className="w-52 h-52 object-cover rounded-xl shadow-2xl border-2 border-border" />
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightbox(null)}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          {lightbox.photos.length > 1 && (
            <>
              <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/40 rounded-full p-2" onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, index: (l.index - 1 + l.photos.length) % l.photos.length } : null); }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button className="absolute right-12 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/40 rounded-full p-2" onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, index: (l.index + 1) % l.photos.length } : null); }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </>
          )}
          <img src={lightbox.photos[lightbox.index]} alt={`Foto ${lightbox.index + 1}`} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
          {lightbox.photos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {lightbox.photos.map((_, i) => (
                <button key={i} onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, index: i } : null); }} className={`w-2 h-2 rounded-full ${i === lightbox.index ? "bg-white" : "bg-white/40"}`} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="border border-border/50 rounded-md bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[100px]">Data</TableHead>
              <TableHead className="w-[60px]">UF</TableHead>
              <TableHead className="w-[100px]">Número</TableHead>
              <TableHead>Título / Local</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Formato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Técnico</TableHead>
              <TableHead className="w-[70px]">Fotos</TableHead>
              <TableHead className="text-right">Valor Est.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <>
                {[...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40 mb-1" />
                      <Skeleton className="h-3 w-32" />
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-9 w-9 rounded" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </>
            ) : ordens?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-32 text-center text-muted-foreground">
                  Nenhuma ordem de serviço encontrada para a unidade {unit}.
                </TableCell>
              </TableRow>
            ) : (
              ordens?.map((os) => {
                // hasPhotos comes from the SQL computed column in LIST_COLUMNS.
                // The actual photo data is excluded from the list for performance and
                // lazy-loaded from /service-orders/:id/photos on hover.
                const hasPhotos = Boolean((os as any).hasPhotos);
                const loadedPhoto = loadedPhotos[os.id];
                return (
                  <TableRow key={os.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setLocation(`/ordens/${os.id}`)}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{format(new Date(os.createdAt), "dd/MM/yyyy")}</TableCell>
                    <TableCell>
                      <span className="text-xs font-mono font-semibold text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded">
                        {(os as any).unidade || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono font-medium text-primary">{os.number}</TableCell>
                    <TableCell>
                      <div className="font-medium truncate max-w-[200px]">{os.title}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">{os.location}</div>
                    </TableCell>
                    <TableCell className="text-sm">{os.tipo ? TIPO_LABELS[os.tipo] : "—"}</TableCell>
                    <TableCell className="text-sm">{os.formatoServico ? FORMATO_SERVICO_LABELS[os.formatoServico] : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[os.status as ServiceOrderStatus]}>{STATUS_LABELS[os.status as ServiceOrderStatus]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={PRIORITY_COLORS[os.priority as ServiceOrderPriority]}>{PRIORITY_LABELS[os.priority as ServiceOrderPriority]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{os.technicianName || <span className="text-muted-foreground italic">Não atribuído</span>}</TableCell>
                    <TableCell>
                      {hasPhotos ? (
                        <div
                          className="relative inline-block cursor-pointer transition-transform duration-150 hover:scale-110"
                          onClick={e => {
                            e.stopPropagation();
                            if (loadedPhoto) {
                              setLightbox({ photos: [loadedPhoto], index: 0 });
                            } else {
                              setLocation(`/ordens/${os.id}`);
                            }
                          }}
                          onMouseEnter={e => {
                            if (loadedPhoto) {
                              setHoveredPhoto({ src: loadedPhoto, x: e.clientX, y: e.clientY });
                            } else {
                              void loadFirstPhoto(os.id);
                            }
                          }}
                          onMouseLeave={() => setHoveredPhoto(null)}
                          title="Ver fotos"
                        >
                          {loadedPhoto ? (
                            <img src={loadedPhoto} alt="foto" className="w-9 h-9 rounded object-cover border-2 border-border shadow-sm" />
                          ) : (
                            <Camera className="w-5 h-5 text-primary mx-auto" />
                          )}
                        </div>
                      ) : (
                        <Camera className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono text-yellow-500">{formatCurrency(os.estimatedValue ?? undefined)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
