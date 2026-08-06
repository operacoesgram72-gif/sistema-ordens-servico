import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Plus, Search, FileSpreadsheet, Camera, FileText, RefreshCw, SlidersHorizontal, Check } from "lucide-react";
import {
  useListServiceOrders,
  ServiceOrderStatus,
  ServiceOrderPriority,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, TIPO_LABELS, FORMATO_SERVICO_LABELS } from "@/lib/constants";
import { useUnit } from "@/contexts/unit-context";
import { generatePDF } from "@/lib/pdf-utils";

// ── Column manager ────────────────────────────────────────────────────────────
const OPTIONAL_COLS = [
  { id: "uf",       label: "UF" },
  { id: "tipo",     label: "Tipo" },
  { id: "formato",  label: "Formato" },
  { id: "conclusao",label: "Conclusão" },
  { id: "fotos",    label: "Fotos" },
] as const;
type OptionalColId = typeof OPTIONAL_COLS[number]["id"];

function loadVisibleCols(): Set<OptionalColId> {
  try {
    const saved = localStorage.getItem("ordens-visible-cols");
    if (saved) return new Set(JSON.parse(saved) as OptionalColId[]);
  } catch { /* ignore */ }
  return new Set<OptionalColId>(["uf", "tipo", "formato", "conclusao", "fotos"]);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const MAX_DISPLAY_CHARS = 2 * 1024 * 1024;

const formatCurrency = (val?: number) => {
  if (val == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
};

type HoveredPhoto = { src: string; x: number; y: number } | null;
type LightboxState = { photos: string[]; index: number } | null;

// ── Component ─────────────────────────────────────────────────────────────────
export default function Ordens() {
  const [, setLocation] = useLocation();
  const { unit } = useUnit();
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [period, setPeriod] = useState<string>("monthly");
  const [tipo, setTipo] = useState<string>("all");
  const [formato, setFormato] = useState<string>("all");

  // Column visibility (persisted to localStorage)
  const [visibleCols, setVisibleCols] = useState<Set<OptionalColId>>(loadVisibleCols);
  const show = (col: OptionalColId) => visibleCols.has(col);
  const totalCols = 7 + visibleCols.size; // 7 fixed + optional

  const toggleCol = (col: OptionalColId) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      try { localStorage.setItem("ordens-visible-cols", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  // Photo hover/lightbox
  const [hoveredPhoto, setHoveredPhoto] = useState<HoveredPhoto>(null);
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Scroll shadow state
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const [scrollEdge, setScrollEdge] = useState({ left: false, right: true });

  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setScrollEdge({
        left: scrollLeft > 2,
        right: scrollLeft + clientWidth < scrollWidth - 2,
      });
    };
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Lazy-load first photo per OS for hover preview
  const [loadedPhotos, setLoadedPhotos] = useState<Record<number, string>>({});
  const loadingPhotosRef = useRef(new Set<number>());
  const loadedPhotosRef  = useRef(new Set<number>());
  const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

  const loadFirstPhoto = useCallback(async (id: number) => {
    if (loadedPhotosRef.current.has(id) || loadingPhotosRef.current.has(id)) return;
    loadingPhotosRef.current.add(id);
    try {
      const res = await fetch(`${BASE_URL}/api/service-orders/${id}/photos`);
      if (!res.ok) return;
      const { photos: raw } = await res.json() as { photos: string | null };
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const MAX_THUMB = 500 * 1024;
      const first = parsed.find(
        (s): s is string =>
          typeof s === "string" &&
          s.startsWith("data:image/") &&
          s.length <= MAX_THUMB
      );
      if (first) {
        loadedPhotosRef.current.add(id);
        setLoadedPhotos(prev => ({ ...prev, [id]: first }));
      }
    } catch { /* silently ignore */ }
    finally { loadingPhotosRef.current.delete(id); }
  }, [BASE_URL]);

  // Query
  const queryKey = useMemo(
    () => ["service-orders", debouncedSearch, status, period, tipo, formato, unit],
    [debouncedSearch, status, period, tipo, formato, unit]
  );

  const { data: ordens, isLoading } = useListServiceOrders(
    {
      search: debouncedSearch || undefined,
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
        `${os.title} - ${os.location}`.replace(/\t/g, " "),
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
        { header: "Data",         key: "data",      width: "9%" },
        { header: "UF",           key: "uf",        width: "5%" },
        { header: "Número",       key: "numero",    width: "9%" },
        { header: "Título / Local",key: "titulo",   width: "20%" },
        { header: "Tipo",         key: "tipo",      width: "9%" },
        { header: "Formato",      key: "formato",   width: "11%" },
        { header: "Status",       key: "status",    width: "9%" },
        { header: "Prioridade",   key: "prioridade",width: "9%" },
        { header: "Técnico",      key: "tecnico",   width: "11%" },
        { header: "Valor Est.",   key: "valor",     width: "8%" },
      ],
      rows: ordens.map(os => ({
        data:      format(new Date(os.createdAt), "dd/MM/yyyy"),
        uf:        (os as any).unidade || "—",
        numero:    os.number,
        titulo:    `${os.title} — ${os.location}`,
        tipo:      os.tipo ? TIPO_LABELS[os.tipo] : "—",
        formato:   os.formatoServico ? FORMATO_SERVICO_LABELS[os.formatoServico] : "—",
        status:    STATUS_LABELS[os.status as ServiceOrderStatus] || os.status,
        prioridade:PRIORITY_LABELS[os.priority as ServiceOrderPriority] || os.priority,
        tecnico:   os.technicianName || "—",
        valor:     formatCurrency(os.estimatedValue ?? undefined),
      })),
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="bg-background border-b border-border/30 shrink-0">
        <div className="px-6 md:px-8 pt-6 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print-hide">
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
              PDF
            </Button>
            <Button variant="outline" onClick={exportToExcel} disabled={!ordens?.length}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button onClick={() => setLocation("/ordens/nova")}>
              <Plus className="w-4 h-4 mr-2" />
              Nova OS
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-4 md:px-8 pb-8 pt-4 max-w-[1600px] mx-auto space-y-4">

          {/* ── Filter bar ──────────────────────────────────────────────────── */}
          <Card className="p-4 bg-card border-border/50 print-hide">
            <div className="flex flex-wrap gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar (número, título)..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos</SelectItem>
                  {Object.entries(TIPO_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={formato} onValueChange={setFormato}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Formato" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Formatos</SelectItem>
                  {Object.entries(FORMATO_SERVICO_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Período" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="daily">Hoje</SelectItem>
                  <SelectItem value="monthly">Este Mês</SelectItem>
                  <SelectItem value="annual">Este Ano</SelectItem>
                </SelectContent>
              </Select>

              {/* Column manager */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="default" className="gap-2 shrink-0" title="Gerenciar colunas visíveis">
                    <SlidersHorizontal className="w-4 h-4" />
                    <span className="hidden sm:inline">Colunas</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-3" align="end">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Colunas visíveis</p>
                  <div className="space-y-0.5">
                    {OPTIONAL_COLS.map(col => (
                      <button
                        key={col.id}
                        onClick={() => toggleCol(col.id)}
                        className="flex items-center gap-2.5 w-full rounded px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${visibleCols.has(col.id) ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                          {visibleCols.has(col.id) && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        {col.label}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </Card>

          {/* ── Photo hover preview ─────────────────────────────────────────── */}
          {hoveredPhoto && (
            <div style={{ position: "fixed", left: hoveredPhoto.x + 14, top: Math.max(8, hoveredPhoto.y - 130), zIndex: 9999, pointerEvents: "none" }}>
              <img src={hoveredPhoto.src} alt="Preview" className="w-52 h-52 object-cover rounded-xl shadow-2xl border-2 border-border" />
            </div>
          )}

          {/* ── Lightbox ────────────────────────────────────────────────────── */}
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

          {/* ── Mobile cards (below md) ─────────────────────────────────────── */}
          <div className="md:hidden space-y-2">
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="p-4 rounded-lg border border-border/50 bg-card space-y-2">
                  <div className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-6 w-20 rounded-full" /></div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <div className="flex justify-between pt-1"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-4 w-20" /></div>
                </div>
              ))
            ) : ordens?.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Nenhuma ordem de serviço encontrada.</div>
            ) : (
              ordens?.map(os => {
                const rawName = (os as any).technicianNameFree || os.technicianName;
                return (
                  <div
                    key={os.id}
                    className="p-4 rounded-lg border border-border/50 bg-card cursor-pointer hover:bg-muted/30 transition-colors active:bg-muted/50"
                    onClick={() => setLocation(`/ordens/${os.id}`)}
                  >
                    {/* Row 1: Number + Status */}
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span className="font-mono font-bold text-primary text-sm">{os.number}</span>
                      <Badge variant="outline" className={STATUS_COLORS[os.status as ServiceOrderStatus]}>
                        {STATUS_LABELS[os.status as ServiceOrderStatus]}
                      </Badge>
                    </div>
                    {/* Row 2: Title + Location */}
                    <div className="mb-2">
                      <div className="font-medium text-sm line-clamp-1">{os.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{os.location}</div>
                    </div>
                    {/* Row 3: Prioridade | Técnico | Valor */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={PRIORITY_COLORS[os.priority as ServiceOrderPriority]}>
                        {PRIORITY_LABELS[os.priority as ServiceOrderPriority]}
                      </Badge>
                      <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                        {rawName || "Não atribuído"}
                      </span>
                      {Boolean((os as any).hasPhotos) && (
                        <Camera className="w-3 h-3 text-primary/70" />
                      )}
                      <span className="font-mono text-xs text-yellow-500 font-medium shrink-0">
                        {formatCurrency(os.estimatedValue ?? undefined)}
                      </span>
                    </div>
                    {/* Date line */}
                    <div className="mt-2 text-xs text-muted-foreground/60">
                      {format(new Date(os.createdAt), "dd/MM/yyyy HH:mm")}
                      {show("uf") && (os as any).unidade && (
                        <span className="ml-2 font-mono font-semibold text-primary/60">{(os as any).unidade}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Desktop table (md+) ─────────────────────────────────────────── */}
          <div className="hidden md:block border border-border/50 rounded-md bg-card relative">
            {/* Left scroll shadow */}
            <div
              className={`pointer-events-none absolute left-0 top-0 bottom-0 w-10 z-30 rounded-l-md transition-opacity duration-200 bg-gradient-to-r from-card/90 to-transparent ${scrollEdge.left ? "opacity-100" : "opacity-0"}`}
            />
            {/* Right scroll shadow */}
            <div
              className={`pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-30 rounded-r-md transition-opacity duration-200 bg-gradient-to-l from-card/90 to-transparent ${scrollEdge.right ? "opacity-100" : "opacity-0"}`}
            />

            {/* Table with always-visible scrollbar on touch */}
            <div
              ref={tableWrapRef}
              className="overflow-x-scroll [&::-webkit-scrollbar]:h-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 [&::-webkit-scrollbar-thumb]:rounded-full"
            >
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {/* Sticky left: Data */}
                    <TableHead className="w-[120px] sticky left-0 z-20 bg-card after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border/50">
                      Data
                    </TableHead>
                    {show("uf") && <TableHead className="w-[56px]">UF</TableHead>}
                    <TableHead className="w-[108px]">Número</TableHead>
                    <TableHead className="min-w-[180px]">Título / Local</TableHead>
                    {show("tipo") && <TableHead className="w-[110px]">Tipo</TableHead>}
                    {show("formato") && <TableHead className="w-[120px]">Formato</TableHead>}
                    <TableHead className="w-[110px]">Status</TableHead>
                    {show("conclusao") && <TableHead className="w-[110px] text-emerald-400">Conclusão</TableHead>}
                    <TableHead className="w-[100px]">Prioridade</TableHead>
                    <TableHead className="min-w-[150px]">Técnico</TableHead>
                    {show("fotos") && <TableHead className="w-[72px] text-center">Fotos</TableHead>}
                    {/* Sticky right: Valor */}
                    <TableHead className="w-[110px] text-right sticky right-0 z-20 bg-card before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border/50">
                      Valor Est.
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(6)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="sticky left-0 bg-card"><Skeleton className="h-4 w-24" /></TableCell>
                        {show("uf") && <TableCell><Skeleton className="h-4 w-10" /></TableCell>}
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40 mb-1" /></TableCell>
                        {show("tipo") && <TableCell><Skeleton className="h-4 w-16" /></TableCell>}
                        {show("formato") && <TableCell><Skeleton className="h-4 w-20" /></TableCell>}
                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                        {show("conclusao") && <TableCell><Skeleton className="h-4 w-20" /></TableCell>}
                        <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        {show("fotos") && <TableCell><Skeleton className="h-8 w-8 rounded mx-auto" /></TableCell>}
                        <TableCell className="sticky right-0 bg-card"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : ordens?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={totalCols} className="h-32 text-center text-muted-foreground">
                        Nenhuma ordem de serviço encontrada para a unidade {unit}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ordens?.map(os => {
                      const hasPhotos = Boolean((os as any).hasPhotos);
                      const loadedPhoto = loadedPhotos[os.id];
                      const rawName = (os as any).technicianNameFree || os.technicianName;
                      const techs = rawName
                        ? rawName.split(" / ").map((t: string) => t.trim()).filter(Boolean)
                        : [];
                      const firstTech = techs[0] as string | undefined;
                      const extraTechs = techs.slice(1) as string[];
                      const titleTooltip = `${os.title} — ${os.location}`;

                      return (
                        <TableRow
                          key={os.id}
                          className="cursor-pointer group hover:bg-muted/50 transition-colors"
                          onClick={() => setLocation(`/ordens/${os.id}`)}
                        >
                          {/* Sticky left: Data */}
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap sticky left-0 z-10 bg-card group-hover:bg-muted/50 transition-colors after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border/40">
                            {format(new Date(os.createdAt), "dd/MM/yy HH:mm")}
                          </TableCell>

                          {show("uf") && (
                            <TableCell>
                              <span className="text-xs font-mono font-semibold text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded">
                                {(os as any).unidade || "—"}
                              </span>
                            </TableCell>
                          )}

                          <TableCell className="font-mono font-medium text-primary text-sm">
                            {os.number}
                          </TableCell>

                          {/* Título / Local — with title tooltip */}
                          <TableCell>
                            <div
                              className="font-medium truncate max-w-[220px] text-sm"
                              title={titleTooltip}
                            >
                              {os.title}
                            </div>
                            <div
                              className="text-xs text-muted-foreground truncate max-w-[220px]"
                              title={os.location}
                            >
                              {os.location}
                            </div>
                          </TableCell>

                          {show("tipo") && (
                            <TableCell className="text-sm text-muted-foreground">
                              {os.tipo ? TIPO_LABELS[os.tipo] : "—"}
                            </TableCell>
                          )}

                          {show("formato") && (
                            <TableCell className="text-sm text-muted-foreground">
                              {os.formatoServico ? FORMATO_SERVICO_LABELS[os.formatoServico] : "—"}
                            </TableCell>
                          )}

                          <TableCell>
                            <Badge variant="outline" className={STATUS_COLORS[os.status as ServiceOrderStatus]}>
                              {STATUS_LABELS[os.status as ServiceOrderStatus]}
                            </Badge>
                          </TableCell>

                          {show("conclusao") && (
                            <TableCell className="text-xs text-emerald-400 whitespace-nowrap">
                              {(os as any).completedAt
                                ? format(new Date((os as any).completedAt), "dd/MM/yy HH:mm")
                                : <span className="text-muted-foreground/30">—</span>}
                            </TableCell>
                          )}

                          <TableCell>
                            <Badge variant="outline" className={PRIORITY_COLORS[os.priority as ServiceOrderPriority]}>
                              {PRIORITY_LABELS[os.priority as ServiceOrderPriority]}
                            </Badge>
                          </TableCell>

                          {/* Técnico — 1 badge + "+N" popover */}
                          <TableCell>
                            {techs.length === 0 ? (
                              <span className="text-muted-foreground italic text-xs">Não atribuído</span>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span
                                  title={rawName}
                                  className="inline-block text-xs bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5 font-medium max-w-[140px] truncate"
                                >
                                  {firstTech}
                                </span>
                                {extraTechs.length > 0 && (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button
                                        onClick={e => e.stopPropagation()}
                                        className="inline-flex items-center text-xs bg-muted/60 text-muted-foreground border border-border/60 rounded px-1.5 py-0.5 font-medium hover:bg-muted transition-colors whitespace-nowrap"
                                        title={extraTechs.join(" / ")}
                                      >
                                        +{extraTechs.length}
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                      className="w-44 p-2"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                                        Todos os técnicos
                                      </p>
                                      <div className="space-y-1">
                                        {techs.map((t: string, i: number) => (
                                          <div key={i} className="text-xs text-foreground px-1.5 py-1 rounded bg-muted/40 truncate" title={t}>
                                            {t}
                                          </div>
                                        ))}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </div>
                            )}
                          </TableCell>

                          {/* Fotos — count badge */}
                          {show("fotos") && (
                            <TableCell className="text-center">
                              {hasPhotos ? (
                                <div
                                  className="inline-flex items-center gap-1 cursor-pointer transition-transform duration-150 hover:scale-110"
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
                                    <img src={loadedPhoto} alt="foto" className="w-8 h-8 rounded object-cover border border-border shadow-sm" />
                                  ) : (
                                    <Camera className="w-4 h-4 text-primary" />
                                  )}
                                </div>
                              ) : (
                                <Camera className="w-4 h-4 text-muted-foreground/25 mx-auto" />
                              )}
                            </TableCell>
                          )}

                          {/* Sticky right: Valor — never truncated */}
                          <TableCell className="text-right font-mono text-sm text-yellow-500 whitespace-nowrap sticky right-0 z-10 bg-card group-hover:bg-muted/50 transition-colors before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border/40">
                            {formatCurrency(os.estimatedValue ?? undefined)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
