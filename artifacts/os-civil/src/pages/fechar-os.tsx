import { useState, useEffect, useCallback } from "react";
import { useSearch, useLocation } from "wouter";
import { format } from "date-fns";
import { ArrowLeft, MapPin, ClipboardList, CheckCircle2, Loader2, WifiOff, RefreshCw, Camera, Image as ImageIcon, X, Edit3, Save, ChevronDown, ChevronUp, Trash2, UserPlus } from "lucide-react";
import { isImageFile, isVideoFile, getVideoContentType, compressImage, MAX_COMPRESS_BYTES } from "@/lib/media-utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { useStatusEvents } from "@/hooks/use-status-events";
import { UNITS, type Unit } from "@/contexts/unit-context";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS } from "@/lib/constants";
import type { ServiceOrderStatus, ServiceOrderPriority } from "@workspace/api-client-react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type OS = {
  id: number;
  number: string;
  title: string;
  location: string;
  description?: string | null;
  department?: string | null;
  notes?: string | null;
  category?: string | null;
  status: string;
  priority: string;
  technicianName?: string | null;
  scheduledAt?: string | null;
  createdAt: string;
};

type EditDraft = Pick<OS, "location" | "department" | "description" | "notes" | "priority" | "technicianName">;

const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(unit: string) {
  return `gram-fechar-os-cache-${unit}`;
}
function getCacheTsKey(unit: string) {
  return `gram-fechar-os-cache-ts-${unit}`;
}

function readCache(unit: string): { orders: OS[]; stale: boolean } {
  try {
    const parsed = JSON.parse(localStorage.getItem(getCacheKey(unit)) || "[]");
    const ts = Number(localStorage.getItem(getCacheTsKey(unit)) || "0");
    const stale = Date.now() - ts > CACHE_MAX_AGE_MS;
    return { orders: Array.isArray(parsed) ? parsed : [], stale };
  } catch {
    return { orders: [], stale: true };
  }
}

function writeCache(unit: string, orders: OS[]): void {
  try {
    localStorage.setItem(getCacheKey(unit), JSON.stringify(orders));
    localStorage.setItem(getCacheTsKey(unit), String(Date.now()));
  } catch {}
}

export default function FecharOS() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const params = new URLSearchParams(search);
  const unitFromUrl = (params.get("u") || "AM") as Unit;
  const unitInfo = UNITS.find(u => u.key === unitFromUrl) || UNITS[0];
  const { isOnline, pendingCount, enqueue } = useOfflineQueue();

  const [ordens, setOrdens] = useState<OS[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  // Pagination: render 30 cards at a time to keep mobile smooth even with 200 orders
  const [visibleCount, setVisibleCount] = useState(30);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);
  const [addingMediaToId, setAddingMediaToId] = useState<number | null>(null);

  // Feature: full OS edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ location: "", department: "", description: "", notes: "", priority: "media", technicianName: "" });
  const [editTechnicians, setEditTechnicians] = useState<string[]>([""]);
  const [savingId, setSavingId] = useState<number | null>(null);

  // Feature: per-OS photo management (lazy-loaded on demand)
  const [osPhotos, setOsPhotos] = useState<Record<number, string[]>>({});
  const [loadingPhotosId, setLoadingPhotosId] = useState<number | null>(null);
  const [showPhotosId, setShowPhotosId] = useState<number | null>(null);

  const handleAddMedia = async (osId: number, files: FileList | null, fromCamera = false) => {
    if (!files || files.length === 0) return;
    setAddingMediaToId(osId);
    try {
      const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB per photo (gallery)

      // Camera inputs (capture="environment") may deliver files with file.type=""
      // AND no extension in file.name on some Android / iOS OEM browsers (e.g.
      // Samsung Internet delivers file.name="image" with no .jpg). isImageFile()
      // would return false for those files and silently drop the photo. Since the
      // input has accept="image/*", every file from the camera IS an image — skip
      // the type check for camera files entirely and let compressImage handle them.
      const allFiles = Array.from(files);
      const vidFiles = allFiles.filter(isVideoFile);
      const imgCandidates = fromCamera
        ? allFiles.filter(f => !isVideoFile(f))          // camera: all non-video files are images
        : allFiles.filter(f => isImageFile(f) && !isVideoFile(f)); // gallery: use extension/type check

      // Camera photos use MAX_COMPRESS_BYTES (50 MB) — compressImage resizes them to
      // 1920 px max and re-encodes as JPEG 0.82, reducing 12 MP raw photos (~8 MB) to
      // ~250 KB before base64 encoding. Gallery photos keep the 8 MB guard.
      const sizeLimit = fromCamera ? MAX_COMPRESS_BYTES : MAX_IMAGE_BYTES;
      const oversized = imgCandidates.filter(f => f.size > sizeLimit);
      if (oversized.length > 0) {
        toast({
          title: "Imagem(ns) ignorada(s)",
          description: `${oversized.length} arquivo(s) acima de ${fromCamera ? "50" : "8"} MB foram ignorados.`,
          variant: "destructive",
        });
      }
      const imgFiles = imgCandidates.filter(f => f.size <= sizeLimit);

      // Convert images to base64 with Canvas compression.
      // compressImage resizes to 1920 px max and re-encodes as JPEG 0.82.
      // Falls back to plain FileReader only when the Canvas 2D context is unavailable.
      const newBase64 = imgFiles.length > 0
        ? await Promise.all(imgFiles.map(f => compressImage(f)))
        : [];

      // Upload videos to object storage
      const videoUrls: string[] = [];
      for (const vid of vidFiles) {
        try {
          // getVideoContentType falls back to "video/mp4" when the browser omits the
          // MIME type — the server rejects empty content types with HTTP 400.
          const effectiveMimeType = getVideoContentType(vid);
          const resp = await fetch(`${BASE_URL}/api/storage/uploads/video-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contentType: effectiveMimeType }),
          });
          if (!resp.ok) continue;
          const { uploadURL, objectPath } = await resp.json() as { uploadURL: string; objectPath: string };
          const putRes = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": effectiveMimeType }, body: vid });
          // Only persist the storage URL when the PUT succeeded — a failed upload
          // must not be saved as a broken link in the OS photos field.
          if (!putRes.ok) throw new Error(`Storage upload failed: HTTP ${putRes.status}`);
          // objectPath is already "/objects/UUID" — prepend "/api/storage" only
          videoUrls.push(`${BASE_URL}/api/storage${objectPath}`);
        } catch {}
      }

      const allNew = [...newBase64, ...videoUrls];
      if (allNew.length === 0) {
        if (files.length > 0) toast({ title: "Nenhum arquivo válido foi processado", variant: "destructive" });
        return;
      }

      // Fetch current photos from the lightweight endpoint and merge
      let existing: string[] = [];
      try {
        const r = await fetch(`${BASE_URL}/api/service-orders/${osId}/photos`);
        if (r.ok) {
          const d = await r.json();
          const parsed = JSON.parse(d.photos || "[]");
          existing = Array.isArray(parsed) ? parsed : [];
        }
      } catch {}

      const merged = [...existing, ...allNew];
      const patchRes = await fetch(`${BASE_URL}/api/service-orders/${osId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos: JSON.stringify(merged) }),
      });
      if (patchRes.ok) {
        toast({ title: "Mídia salva!", description: `${allNew.length} arquivo(s) vinculados à OS.` });
      } else {
        throw new Error("Erro ao salvar");
      }
    } catch {
      toast({ title: "Erro ao salvar mídia", variant: "destructive" });
    } finally {
      setAddingMediaToId(null);
    }
  };

  // ── Feature: full OS edit ──────────────────────────────────────────────
  const startEdit = (os: OS) => {
    const techList = os.technicianName
      ? os.technicianName.split(" / ").map(s => s.trim()).filter(Boolean)
      : [""];
    setEditTechnicians(techList);
    setEditDraft({
      location: os.location ?? "",
      department: os.department ?? "",
      description: os.description ?? "",
      notes: os.notes ?? "",
      priority: os.priority ?? "media",
      technicianName: os.technicianName ?? "",
    });
    setEditingId(os.id);
    // Auto-show existing photos when entering edit mode so the technician can
    // see what's already attached before deciding to add or remove photos.
    setShowPhotosId(os.id);
    void loadPhotos(os.id);
  };

  const handleSaveEdit = async (id: number) => {
    const technicianName = editTechnicians.filter(t => t.trim()).join(" / ") || "";
    const body = { ...editDraft, technicianName };

    // Offline path: queue the edit and apply it optimistically to local state
    if (!isOnline) {
      enqueue({
        type: "patch-edit",
        endpoint: `/api/service-orders/${id}`,
        method: "PATCH",
        body: body as Record<string, unknown>,
        unit: unitFromUrl,
        label: `Editar OS #${id}`,
      });
      setOrdens(prev => {
        const next = prev.map(o => o.id === id ? { ...o, ...body } : o);
        writeCache(unitFromUrl, next);
        return next;
      });
      setEditingId(null);
      toast({ title: "Alterações salvas localmente", description: "Serão enviadas ao reconectar." });
      return;
    }

    setSavingId(id);
    try {
      const res = await fetch(`${BASE_URL}/api/service-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated: OS = await res.json();
      setOrdens(prev => {
        const next = prev.map(o => o.id === id ? { ...o, ...updated } : o);
        writeCache(unitFromUrl, next);
        return next;
      });
      setEditingId(null);
      toast({ title: "OS atualizada!" });
    } catch (e) {
      // Network-level failure while navigator.onLine = true: queue for later
      const isNetErr = e instanceof TypeError && /fetch|network|failed|load/i.test((e as TypeError).message);
      if (isNetErr) {
        enqueue({
          type: "patch-edit",
          endpoint: `/api/service-orders/${id}`,
          method: "PATCH",
          body: body as Record<string, unknown>,
          unit: unitFromUrl,
          label: `Editar OS #${id}`,
        });
        setOrdens(prev => {
          const next = prev.map(o => o.id === id ? { ...o, ...body } : o);
          writeCache(unitFromUrl, next);
          return next;
        });
        setEditingId(null);
        toast({ title: "Salvo localmente", description: "Será sincronizado ao reconectar." });
      } else {
        toast({ title: "Erro ao salvar alterações", variant: "destructive" });
      }
    } finally {
      setSavingId(null);
    }
  };

  // ── Feature: per-OS photo viewing and deletion ─────────────────────────
  const loadPhotos = async (osId: number) => {
    if (osPhotos[osId] !== undefined) return; // already loaded
    setLoadingPhotosId(osId);
    try {
      const r = await fetch(`${BASE_URL}/api/service-orders/${osId}/photos`);
      if (r.ok) {
        const d = await r.json() as { photos: string | null };
        const list: string[] = (() => { try { const p = JSON.parse(d.photos || "[]"); return Array.isArray(p) ? p : []; } catch { return []; } })();
        setOsPhotos(prev => ({ ...prev, [osId]: list }));
      }
    } catch {
      setOsPhotos(prev => ({ ...prev, [osId]: [] }));
    } finally {
      setLoadingPhotosId(null);
    }
  };

  const togglePhotos = (osId: number) => {
    if (showPhotosId === osId) { setShowPhotosId(null); return; }
    setShowPhotosId(osId);
    void loadPhotos(osId);
  };

  const handleDeleteOsPhoto = async (osId: number, idx: number) => {
    if (!confirm("Remover este anexo da OS?")) return;
    const current = osPhotos[osId] || [];
    const next = current.filter((_, i) => i !== idx);
    try {
      const res = await fetch(`${BASE_URL}/api/service-orders/${osId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos: JSON.stringify(next) }),
      });
      if (!res.ok) throw new Error();
      setOsPhotos(prev => ({ ...prev, [osId]: next }));
      toast({ title: "Foto removida" });
    } catch {
      toast({ title: "Erro ao remover foto", variant: "destructive" });
    }
  };

  const loadOrdens = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setFromCache(false);
    try {
      // Limit to 200 most-recent OS — keeps the response small and the card list
      // manageable. Employees working on a specific unit will never need >200 open calls.
      const res = await fetch(`${BASE_URL}/api/service-orders?unidade=${unitFromUrl}&limit=200`);
      if (res.ok) {
        const data = await res.json();
        setOrdens(data);
        writeCache(unitFromUrl, data);
      } else {
        throw new Error("Server error");
      }
    } catch {
      // Fallback to cache (works offline or on transient network errors)
      const { orders: cached } = readCache(unitFromUrl);
      if (cached.length > 0) {
        setOrdens(cached);
        setFromCache(true);
      } else {
        toast({ title: "Erro ao carregar ordens", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  }, [unitFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time SSE updates — apply status changes broadcast by other clients
  const connectionState = useStatusEvents(
    useCallback((event) => {
      // Only apply events for the current unit
      if (event.unidade !== unitFromUrl) return;
      setOrdens(prev => {
        const exists = prev.some(o => o.id === event.id);
        if (!exists) return prev;
        const updated = prev.map(o =>
          o.id === event.id ? { ...o, status: event.status } : o
        );
        writeCache(unitFromUrl, updated);
        return updated;
      });
      toast({
        title: `OS ${event.number} atualizada`,
        description: `Status → ${STATUS_LABELS[event.status as ServiceOrderStatus] || event.status}`,
      });
    }, [unitFromUrl, toast]), // eslint-disable-line react-hooks/exhaustive-deps
    useCallback(() => {
      // Re-sync the list to catch anything missed while the stream was down.
      void loadOrdens();
    }, [loadOrdens])
  );

  useEffect(() => {
    // If we have fresh cache, show it immediately and refresh silently in background.
    // This makes the portal feel instant on re-visits without a visible loading spinner.
    const { orders: cached, stale } = readCache(unitFromUrl);
    if (cached.length > 0 && !stale) {
      setOrdens(cached);
      setLoading(false);
      void loadOrdens(false); // background refresh
    } else {
      void loadOrdens(true); // show spinner
    }
  }, [unitFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusChange = async (id: number, newStatus: string) => {
    // Capture previous status BEFORE any state change for safe rollback
    const previousStatus = ordens.find(o => o.id === id)?.status;
    if (previousStatus === undefined) return;

    // Optimistic update — use functional setter to avoid stale closure issues
    setOrdens(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));

    // If offline: queue the patch and persist optimistic state to cache
    if (!isOnline) {
      const os = ordens.find(o => o.id === id);
      enqueue({
        type: "patch-status",
        endpoint: `/api/service-orders/${id}/status`,
        method: "PATCH",
        body: { status: newStatus },
        unit: unitFromUrl,
        label: `Status ${os?.number || id} → ${STATUS_LABELS[newStatus as ServiceOrderStatus] || newStatus}`,
      });
      // Persist optimistic state to cache so reload shows updated status
      setOrdens(prev => {
        writeCache(unitFromUrl, prev);
        return prev;
      });
      setSuccessId(id);
      setTimeout(() => setSuccessId(null), 2000);
      toast({ title: "Status salvo localmente", description: "Será sincronizado ao reconectar." });
      return;
    }

    // Online: send immediately
    setUpdatingId(id);
    try {
      const res = await fetch(`${BASE_URL}/api/service-orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Persist confirmed state to cache
      setOrdens(prev => {
        writeCache(unitFromUrl, prev);
        return prev;
      });
      setSuccessId(id);
      setTimeout(() => setSuccessId(null), 2000);
      toast({ title: "Status atualizado!" });
    } catch (e) {
      // Network-level failure while navigator.onLine = true (weak signal,
      // captive portal, etc.) → queue the change instead of reverting,
      // keeping the optimistic update visible to the technician.
      const isNetErr = e instanceof TypeError && /fetch|network|failed|load/i.test((e as TypeError).message);
      if (isNetErr) {
        const os = ordens.find(o => o.id === id);
        enqueue({
          type: "patch-status",
          endpoint: `/api/service-orders/${id}/status`,
          method: "PATCH",
          body: { status: newStatus },
          unit: unitFromUrl,
          label: `Status ${os?.number || id} → ${STATUS_LABELS[newStatus as ServiceOrderStatus] || newStatus}`,
        });
        setOrdens(prev => {
          writeCache(unitFromUrl, prev);
          return prev;
        });
        setSuccessId(id);
        setTimeout(() => setSuccessId(null), 2000);
        toast({ title: "Status salvo localmente", description: "Será sincronizado ao reconectar." });
      } else {
        // Server error (4xx/5xx) — revert optimistic update
        setOrdens(prev => prev.map(o => o.id === id ? { ...o, status: previousStatus } : o));
        toast({ title: "Erro ao atualizar status", variant: "destructive" });
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const goBack = () => setLocation(`/registrar?u=${unitFromUrl}`);

  return (
    <div className="min-h-screen bg-background text-foreground dark flex flex-col">
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-amber-500/90 text-black text-xs font-semibold px-4 py-2 flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          Sem conexão — alterações serão sincronizadas ao reconectar
          {pendingCount > 0 && ` (${pendingCount} em fila)`}
        </div>
      )}

      {/* Cached data notice */}
      {fromCache && (
        <div className="bg-blue-500/10 border-b border-blue-500/20 text-blue-400 text-xs px-4 py-1.5 flex items-center justify-center gap-2">
          Exibindo dados em cache — sem conexão com o servidor
        </div>
      )}

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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-default">
                  <span className="relative flex h-2 w-2">
                    {connectionState === "reconnecting" && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        connectionState === "connected"
                          ? "bg-emerald-500"
                          : connectionState === "reconnecting"
                            ? "bg-amber-400"
                            : "bg-red-500"
                      }`}
                    />
                  </span>
                  <span className="hidden sm:inline">
                    {connectionState === "connected"
                      ? "Ao vivo"
                      : connectionState === "reconnecting"
                        ? "Reconectando…"
                        : "Sem conexão"}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {connectionState === "connected"
                  ? "Recebendo atualizações em tempo real"
                  : connectionState === "reconnecting"
                    ? "Reconectando…"
                    : "Sem conexão com o servidor"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {isOnline && (
            <button
              onClick={() => void loadOrdens()}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              title="Atualizar lista"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
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
            Atualize o status, edite os campos e gerencie as fotos de cada OS da sua unidade.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Carregando ordens...
          </div>
        ) : ordens.length === 0 ? (
          <Card className="bg-card border-border/50">
            <CardContent className="p-10 text-center space-y-3">
              <p className="text-muted-foreground">Nenhuma ordem de serviço encontrada para a unidade {unitFromUrl}.</p>
              {isOnline && (
                <Button variant="outline" size="sm" onClick={() => void loadOrdens()} className="gap-2">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Tentar novamente
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {ordens.slice(0, visibleCount).map(os => (
              <Card key={os.id} className={`bg-card border-border/50 transition-all ${successId === os.id ? "border-emerald-500/50 bg-emerald-500/5" : ""}`}>
                <CardContent className="p-4 space-y-3">
                  {/* OS header */}
                  <div className="flex flex-wrap items-start gap-2 justify-between">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-primary text-sm">{os.number}</span>
                        <span className="text-sm text-muted-foreground">—</span>
                        <span className="font-medium text-sm truncate">{os.title}</span>
                      </div>
                      {editingId !== os.id && (
                        <>
                          <div className="text-xs text-muted-foreground">
                            Local: {os.location}{os.department ? ` · ${os.department}` : ""} · {os.technicianName ? `Técnico: ${os.technicianName}` : "Sem técnico"} · {format(new Date(os.createdAt), "dd/MM/yyyy")}
                          </div>
                          {os.description && (
                            <div className="text-xs text-muted-foreground/80 mt-0.5 line-clamp-2 italic">
                              {os.description}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {successId === os.id && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                      {editingId === os.id ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 px-2 text-xs gap-1">
                            <X className="w-3.5 h-3.5" /> Cancelar
                          </Button>
                          <Button size="sm" onClick={() => void handleSaveEdit(os.id)} disabled={savingId === os.id} className="h-7 px-2 text-xs gap-1">
                            {savingId === os.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            Salvar
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => startEdit(os)} className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground">
                          <Edit3 className="w-3.5 h-3.5" /> Editar
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* ── Inline edit form ── */}
                  {editingId === os.id && (
                    <div className="space-y-3 pt-2 border-t border-border/40">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Local</label>
                          <Input value={editDraft.location ?? ""} onChange={e => setEditDraft(d => ({ ...d, location: e.target.value }))} placeholder="Local do serviço" className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Departamento</label>
                          <Input value={editDraft.department ?? ""} onChange={e => setEditDraft(d => ({ ...d, department: e.target.value }))} placeholder="Departamento / setor" className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs font-medium text-muted-foreground">Técnicos Responsáveis</label>
                          <div className="space-y-1.5">
                            {editTechnicians.map((name, idx) => (
                              <div key={idx} className="flex gap-1.5 items-center">
                                <Input
                                  value={name}
                                  onChange={e => {
                                    const next = editTechnicians.map((t, i) => i === idx ? e.target.value : t);
                                    setEditTechnicians(next);
                                    setEditDraft(d => ({ ...d, technicianName: next.filter(t => t.trim()).join(" / ") }));
                                  }}
                                  placeholder={idx === 0 ? "Nome do técnico" : `Técnico ${idx + 1}`}
                                  className="h-8 text-sm"
                                />
                                {editTechnicians.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = editTechnicians.filter((_, i) => i !== idx);
                                      setEditTechnicians(next);
                                      setEditDraft(d => ({ ...d, technicianName: next.filter(t => t.trim()).join(" / ") }));
                                    }}
                                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditTechnicians(prev => [...prev, ""])}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-1"
                          >
                            <UserPlus className="w-3 h-3" />
                            Adicionar Técnico
                          </button>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
                          <Select value={editDraft.priority ?? "media"} onValueChange={val => setEditDraft(d => ({ ...d, priority: val }))}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                                <SelectItem key={v} value={v}>{l}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                        <Textarea value={editDraft.description ?? ""} onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))} placeholder="Descrição do serviço..." className="min-h-[60px] text-sm" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Notas / Andamento</label>
                        <Textarea value={editDraft.notes ?? ""} onChange={e => setEditDraft(d => ({ ...d, notes: e.target.value }))} placeholder="Observações, materiais utilizados..." className="min-h-[60px] text-sm" />
                      </div>
                    </div>
                  )}

                  {/* Priority badge (hidden while editing) */}
                  {editingId !== os.id && (
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={PRIORITY_COLORS[os.priority as ServiceOrderPriority] ?? ""}>
                        {PRIORITY_LABELS[os.priority as ServiceOrderPriority] || os.priority}
                      </Badge>
                    </div>
                  )}

                  {/* Photo / video upload + existing photo viewer */}
                  <div className="space-y-2 pt-1 border-t border-border/30">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">Fotos/Vídeo:</span>
                      <button
                        type="button"
                        title="Tirar foto"
                        disabled={addingMediaToId === os.id}
                        onClick={() => document.getElementById(`media-camera-${os.id}`)?.click()}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title="Galeria"
                        disabled={addingMediaToId === os.id}
                        onClick={() => document.getElementById(`media-gallery-${os.id}`)?.click()}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                      >
                        <ImageIcon className="w-4 h-4" />
                      </button>
                      {addingMediaToId === os.id && (
                        <span className="text-xs text-primary animate-pulse ml-1">Salvando…</span>
                      )}
                      {/* Toggle to view / manage existing photos */}
                      <button
                        type="button"
                        onClick={() => togglePhotos(os.id)}
                        className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                        title="Ver / remover fotos existentes"
                      >
                        {loadingPhotosId === os.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : showPhotosId === os.id
                            ? <ChevronUp className="w-3.5 h-3.5" />
                            : <ChevronDown className="w-3.5 h-3.5" />}
                        Ver fotos
                      </button>
                      {/* Gallery includes videos; video camera recording removed for stability */}
                      <input id={`media-camera-${os.id}`} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => { void handleAddMedia(os.id, e.target.files, true); if (showPhotosId === os.id) setOsPhotos(p => ({ ...p, [os.id]: undefined as any })); }} />
                      <input id={`media-gallery-${os.id}`} type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => { void handleAddMedia(os.id, e.target.files, false); if (showPhotosId === os.id) setOsPhotos(p => ({ ...p, [os.id]: undefined as any })); }} />
                    </div>

                    {/* Existing photos grid with delete buttons */}
                    {showPhotosId === os.id && (
                      <div className="pt-1">
                        {(osPhotos[os.id] ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground/60 italic">Nenhuma foto anexada.</p>
                        ) : (
                          <div className="grid grid-cols-3 gap-2">
                            {(osPhotos[os.id] ?? []).map((src, idx) => {
                              const isVideo = src.startsWith("data:video/") || /\.(mp4|webm|mov)(\?|$)/i.test(src);
                              return (
                                <div key={idx} className="relative group rounded border border-border overflow-hidden">
                                  {isVideo ? (
                                    <div className="w-full h-20 flex items-center justify-center bg-muted/40">
                                      <ImageIcon className="w-6 h-6 text-muted-foreground" />
                                    </div>
                                  ) : (
                                    <img src={src} alt="Anexo" className="w-full h-20 object-cover" />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteOsPhoto(os.id, idx)}
                                    title="Remover foto"
                                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors opacity-100"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Editable status */}
                  <div className="flex items-center gap-3 pt-1 border-t border-border/40">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-14 shrink-0">Status</span>
                    <div className="flex-1 max-w-[220px]">
                      <Select
                        value={os.status}
                        onValueChange={(val) => void handleStatusChange(os.id, val)}
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
            {/* Load-more pagination — prevents rendering 200 cards at once on mobile */}
            {visibleCount < ordens.length && (
              <div className="flex flex-col items-center gap-2 pt-2">
                <p className="text-xs text-muted-foreground">
                  Exibindo {Math.min(visibleCount, ordens.length)} de {ordens.length} ordens
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVisibleCount(v => Math.min(v + 30, ordens.length))}
                  className="gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Carregar mais
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
