import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Wind, Link as LinkIcon, Plus, Trash2, ExternalLink, Pencil, Check, X, Image as ImageIcon, Camera, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { isImageFile, compressImage, MAX_COMPRESS_BYTES } from "@/lib/media-utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const QUARTERS = [
  { key: "q1", label: "JAN - MAR", months: "Janeiro / Fevereiro / Março" },
  { key: "q2", label: "ABR - JUN", months: "Abril / Maio / Junho" },
  { key: "q3", label: "JUL - SET", months: "Julho / Agosto / Setembro" },
  { key: "q4", label: "OUT - DEZ", months: "Outubro / Novembro / Dezembro" },
] as const;

type QuarterKey = "q1" | "q2" | "q3" | "q4";

type PhotoLink = { id: string; url: string; label: string };

type QuarterData = {
  execucao: string;
  ok: boolean;
  fotos: PhotoLink[];
};

type PmocRow = {
  id: string;
  empresa: string;
  cod: string;
  modelo: string;
  tensao: string;
  btu: string;
  local: string;
  tipoArea: string;
  linkFicha: string;
  q1: QuarterData;
  q2: QuarterData;
  q3: QuarterData;
  q4: QuarterData;
  observacao: string;
};

type EditingCell =
  | { rowId: string; field: "empresa" | "cod" | "modelo" | "tensao" | "btu" | "local" | "tipoArea" | "linkFicha" | "observacao" }
  | { rowId: string; field: "execucao"; quarter: QuarterKey }
  | null;

type PhotoDialogState = { rowId: string; quarter: QuarterKey } | null;

const STATE_TABS = [
  { key: "amazonas", label: "Amazonas" },
  { key: "amapa", label: "Amapá" },
  { key: "acre", label: "Acre" },
  { key: "rondonia", label: "Rondônia" },
  { key: "roraima", label: "Roraima" },
  { key: "interiores", label: "Interiores" },
] as const;

type StateTabKey = "amazonas" | "amapa" | "acre" | "rondonia" | "roraima" | "interiores";

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

function emptyQuarter(): QuarterData {
  return { execucao: "", ok: false, fotos: [] };
}

const defaultRows: PmocRow[] = [
  {
    id: genId(), empresa: "", cod: "AR001", modelo: "SPLIT DUTO DAIKIN", tensao: "220", btu: "48.000",
    local: "TRANSMISSORES 01", tipoArea: "ESTRATÉGICO", linkFicha: "",
    q1: { execucao: "Fevereiro", ok: true, fotos: [] },
    q2: { execucao: "Maio", ok: true, fotos: [] },
    q3: { execucao: "Agosto", ok: false, fotos: [] },
    q4: { execucao: "Novembro", ok: false, fotos: [] },
    observacao: "",
  },
  {
    id: genId(), empresa: "", cod: "AR002", modelo: "CASSETE DAIKIN", tensao: "220", btu: "36.000",
    local: "REFEITÓRIO", tipoArea: "ADMINISTRATIVO", linkFicha: "",
    q1: { execucao: "Fevereiro", ok: true, fotos: [] },
    q2: { execucao: "Maio", ok: true, fotos: [] },
    q3: { execucao: "Agosto", ok: false, fotos: [] },
    q4: { execucao: "Novembro", ok: false, fotos: [] },
    observacao: "",
  },
];

function loadRows(storageKey: string, fallback: PmocRow[]): PmocRow[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return JSON.parse(raw) as PmocRow[];
  } catch {}
  return fallback;
}

function saveRows(storageKey: string, rows: PmocRow[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(rows));
  } catch {}
  // Persist to server in the background; failures are non-blocking.
  // localStorage already has the data for the current session, so this is
  // a best-effort background sync.
  fetch(`${BASE_URL}/api/pmoc/${encodeURIComponent(storageKey)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  }).catch(() => undefined);
}

interface PmocTableProps {
  storageKey: string;
  initialRows?: PmocRow[];
}

function PmocTable({ storageKey, initialRows = [] }: PmocTableProps) {
  const { toast } = useToast();
  const [rows, setRowsRaw] = useState<PmocRow[]>(() => loadRows(storageKey, initialRows));
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  // Excel-style column filters — Record<field, selected values[]>. Empty = show all.
  const [colFilters, setColFilters] = useState<Record<string, string[]>>({});
  // Which column's dropdown is open
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  // Search text inside each column's dropdown
  const [filterSearch, setFilterSearch] = useState<Record<string, string>>({});

  // Close dropdown on outside click
  useEffect(() => {
    if (!openFilter) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest("[data-pmoc-filter]")) setOpenFilter(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openFilter]);

  const filterFields = ["empresa", "cod", "modelo", "tensao", "btu", "local", "tipoArea", "observacao"] as const;

  // Derive unique values per fixed column
  const uniqueVals = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const f of filterFields) {
      result[f] = [...new Set(rows.map(r => (r[f] as string) || "").filter(Boolean))].sort();
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const filteredRows = useMemo(() => {
    const active = Object.entries(colFilters).filter(([, vals]) => vals.length > 0);
    if (!active.length) return rows;
    return rows.filter(row =>
      active.every(([field, selectedVals]) => {
        const val = (row[field as keyof PmocRow] as string) ?? "";
        return selectedVals.includes(val);
      })
    );
  }, [rows, colFilters]);

  const toggleFilterVal = (field: string, val: string) => {
    setColFilters(prev => {
      const cur = prev[field] ?? [];
      const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val];
      return { ...prev, [field]: next };
    });
  };
  const clearFilter = (field: string) => setColFilters(prev => ({ ...prev, [field]: [] }));
  const hasActiveFilters = Object.values(colFilters).some(v => v.length > 0);

  // ── Column resizing ────────────────────────────────────────────────────
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizingRef = useRef<{ field: string; startX: number; startW: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      const delta = e.clientX - r.startX;
      setColWidths(prev => ({ ...prev, [r.field]: Math.max(48, r.startW + delta) }));
    };
    const onUp = () => { resizingRef.current = null; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  // ── Excel-style column filter header cell ──────────────────────────────
  // Regular function (not a React component) — called directly in JSX below.
  function colHeader(field: string, label: string, thClass: string) {
    const active = (colFilters[field] ?? []).length > 0;
    const search = filterSearch[field] ?? "";
    const isOpen = openFilter === field;
    const vals = (uniqueVals[field] ?? [])
      .filter(v => !search || v.toLowerCase().includes(search.toLowerCase()));
    const selectedVals = colFilters[field] ?? [];
    const dynStyle = colWidths[field] !== undefined
      ? { width: colWidths[field], minWidth: colWidths[field] } as React.CSSProperties
      : undefined;
    return (
      <th key={field} className={`relative ${thClass}`} data-pmoc-filter="" style={dynStyle}>
        <div className="flex items-center gap-1 whitespace-nowrap">
          <span>{label}</span>
          <button
            data-pmoc-filter=""
            onMouseDown={e => e.stopPropagation()}
            onClick={() => {
              setOpenFilter(isOpen ? null : field);
              if (!isOpen) setFilterSearch(p => ({ ...p, [field]: "" }));
            }}
            className={`ml-auto shrink-0 p-0.5 rounded hover:bg-muted/60 transition-colors ${active ? "text-primary" : "text-muted-foreground/30 hover:text-muted-foreground"}`}
            title="Filtrar coluna"
          >
            {/* Material Icons filter glyph */}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/></svg>
          </button>
        </div>
        {isOpen && (
          <div
            data-pmoc-filter=""
            onMouseDown={e => e.stopPropagation()}
            className="absolute top-full left-0 z-[200] bg-card border border-border rounded-lg shadow-2xl min-w-[200px] max-w-[260px] p-2 space-y-1.5 mt-0.5"
          >
            <input
              data-pmoc-filter=""
              autoFocus
              placeholder="Pesquisar valores…"
              value={search}
              onChange={e => setFilterSearch(p => ({ ...p, [field]: e.target.value }))}
              className="w-full text-xs px-2 py-1.5 border border-border/60 rounded outline-none bg-background focus:border-primary/50"
            />
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              <label className="flex items-center gap-2 text-xs px-1.5 py-0.5 rounded hover:bg-muted/40 cursor-pointer select-none" data-pmoc-filter="">
                <input
                  data-pmoc-filter=""
                  type="checkbox"
                  className="w-3 h-3 accent-primary"
                  checked={selectedVals.length === 0}
                  onChange={() => clearFilter(field)}
                />
                <span className="text-muted-foreground italic">(Todos)</span>
              </label>
              {vals.length === 0 && (
                <p className="text-[10px] text-muted-foreground/60 px-2 py-1 italic">Nenhum resultado</p>
              )}
              {vals.map(val => (
                <label key={val} className="flex items-center gap-2 text-xs px-1.5 py-0.5 rounded hover:bg-muted/40 cursor-pointer select-none" data-pmoc-filter="">
                  <input
                    data-pmoc-filter=""
                    type="checkbox"
                    className="w-3 h-3 accent-primary"
                    checked={selectedVals.includes(val)}
                    onChange={() => toggleFilterVal(field, val)}
                  />
                  <span className="truncate flex-1">{val}</span>
                </label>
              ))}
            </div>
            <div className="border-t border-border/50 pt-1 flex gap-1" data-pmoc-filter="">
              <button
                data-pmoc-filter=""
                onClick={() => { clearFilter(field); setOpenFilter(null); }}
                className="flex-1 text-[10px] py-1 rounded bg-muted/40 hover:bg-muted text-muted-foreground transition-colors"
              >
                Limpar
              </button>
              <button
                data-pmoc-filter=""
                onClick={() => setOpenFilter(null)}
                className="flex-1 text-[10px] py-1 rounded bg-primary/20 hover:bg-primary/30 text-primary transition-colors font-medium"
              >
                OK
              </button>
            </div>
          </div>
        )}
        {/* Drag-to-resize handle */}
        <div
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 select-none"
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
            const th = (e.currentTarget as HTMLElement).closest("th") as HTMLElement | null;
            resizingRef.current = { field, startX: e.clientX, startW: th ? th.offsetWidth : 80 };
          }}
        />
      </th>
    );
  }

  // On mount: fetch server data and update state + localStorage cache.
  // The server is the source of truth.
  // 404 → key not yet saved server-side; keep local data (first-time use).
  // 200 → server has authoritative rows, even if empty; overwrite local.
  // Network error → keep whatever localStorage / initialRows gave us.
  useEffect(() => {
    fetch(`${BASE_URL}/api/pmoc/${encodeURIComponent(storageKey)}`)
      .then(r => {
        if (r.status === 404) return null;        // no server record yet
        if (!r.ok) return Promise.reject(r.status);
        return r.json() as Promise<{ rows: PmocRow[] }>;
      })
      .then((payload) => {
        if (payload === null) return;             // 404 → keep local data
        const serverRows = Array.isArray(payload.rows) ? payload.rows : [];
        setRowsRaw(serverRows);
        try { localStorage.setItem(storageKey, JSON.stringify(serverRows)); } catch {}
      })
      .catch(() => {
        // Network/server error — keep whatever localStorage / initialRows gave us
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  const [editValue, setEditValue] = useState("");
  const [photoDialog, setPhotoDialog] = useState<PhotoDialogState>(null);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newPhotoLabel, setNewPhotoLabel] = useState("");
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const setRows = useCallback((updater: PmocRow[] | ((prev: PmocRow[]) => PmocRow[])) => {
    setRowsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveRows(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const addRow = () => {
    const nextCod = `AR${String(rows.length + 1).padStart(3, "0")}`;
    setRows(prev => [...prev, {
      id: genId(), empresa: "", cod: nextCod, modelo: "", tensao: "220", btu: "",
      local: "", tipoArea: "ESTRATÉGICO", linkFicha: "",
      q1: emptyQuarter(), q2: emptyQuarter(), q3: emptyQuarter(), q4: emptyQuarter(),
      observacao: "",
    }]);
  };

  const removeRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

  const startEdit = (rowId: string, field: any, quarter?: QuarterKey, currentValue = "") => {
    setEditingCell(quarter ? { rowId, field, quarter } : { rowId, field });
    setEditValue(currentValue);
  };

  const commitEdit = () => {
    if (!editingCell) return;
    setRows(prev => prev.map(row => {
      if (row.id !== editingCell.rowId) return row;
      if ("quarter" in editingCell) {
        const q = { ...row[editingCell.quarter], execucao: editValue };
        return { ...row, [editingCell.quarter]: q };
      }
      return { ...row, [editingCell.field]: editValue };
    }));
    setEditingCell(null);
  };

  const toggleOk = (rowId: string, quarter: QuarterKey) => {
    setRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const qdata = row[quarter];
      const q = { ...qdata, ok: !qdata.ok };
      return { ...row, [quarter]: q };
    }));
  };

  const openPhotoDialog = (rowId: string, quarter: QuarterKey) => {
    setPhotoDialog({ rowId, quarter });
    setNewPhotoUrl("");
    setNewPhotoLabel("");
  };

  const addPhoto = () => {
    if (!photoDialog || !newPhotoUrl.trim()) return;
    const url = newPhotoUrl.startsWith("http") ? newPhotoUrl : `https://${newPhotoUrl}`;
    const photo: PhotoLink = { id: genId(), url, label: newPhotoLabel.trim() || url };
    setRows(prev => prev.map(row => {
      if (row.id !== photoDialog.rowId) return row;
      const q = { ...row[photoDialog.quarter], fotos: [...row[photoDialog.quarter].fotos, photo] };
      return { ...row, [photoDialog.quarter]: q };
    }));
    setNewPhotoUrl("");
    setNewPhotoLabel("");
    toast({ title: "Foto adicionada!" });
  };

  const removePhoto = (rowId: string, quarter: QuarterKey, photoId: string) => {
    setRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const q = { ...row[quarter], fotos: row[quarter].fotos.filter(f => f.id !== photoId) };
      return { ...row, [quarter]: q };
    }));
  };

  // Upload photos from device (camera or gallery/PC).
  // Applies the same compressImage pattern used in registrar-os and fechar-os:
  // - Camera inputs bypass isImageFile() (Android OEM browsers deliver file.type="" for camera files)
  // - compressImage resizes to 1920 px max, re-encodes as JPEG 0.82 (~250 KB per photo)
  // - Base64 result stored in the PhotoLink.url field (same as OS photos in PostgreSQL)
  const handlePhotoUpload = async (files: FileList | null, fromCamera = false) => {
    if (!photoDialog || !files || files.length === 0) return;
    setUploadingPhotos(true);
    try {
      const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB for gallery
      const allFiles = Array.from(files);
      // Camera: all files are images (accept="image/*" guarantees it; skip MIME check
      // because Android OEM browsers deliver file.type="" for camera captures).
      // Gallery: use isImageFile() which falls back to extension when type is empty.
      const imgCandidates = fromCamera
        ? allFiles.filter(f => !f.type.startsWith("video/"))
        : allFiles.filter(f => isImageFile(f));
      const sizeLimit = fromCamera ? MAX_COMPRESS_BYTES : MAX_IMAGE_BYTES;
      const oversized = imgCandidates.filter(f => f.size > sizeLimit);
      if (oversized.length > 0) {
        toast({
          title: "Imagem(ns) ignorada(s)",
          description: `${oversized.length} arquivo(s) acima de ${fromCamera ? "50" : "8"} MB foram ignorados.`,
          variant: "destructive",
        });
      }
      const validFiles = imgCandidates.filter(f => f.size <= sizeLimit);
      if (validFiles.length === 0) return;
      // compressImage resizes to 1920 px max, re-encodes as JPEG 0.82.
      // Falls back to plain FileReader only when the Canvas 2D context is unavailable.
      // For each file: try canvas compression first.
      // If compressImage rejects (e.g. browser cannot decode the format — HEIC on
      // Chrome Android, AVIF on older browsers, JPEGs with unusual colour profiles),
      // fall back to a plain FileReader.readAsDataURL so the raw bytes are stored
      // as base64. Gallery files are already limited to 8 MB above, so the
      // uncompressed base64 is safe to store. Camera path is unaffected.
      const readAsDataUrl = (f: File): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("FileReader failed"));
          reader.readAsDataURL(f);
        });

      const base64List = await Promise.all(
        validFiles.map(f =>
          fromCamera
            ? compressImage(f)
            : compressImage(f).catch(() => readAsDataUrl(f)),
        ),
      );
      const newPhotos: PhotoLink[] = base64List.map((url, i) => ({
        id: genId(),
        url,
        label: validFiles[i].name?.replace(/\.[^/.]+$/, "") || `Foto ${i + 1}`,
      }));
      // Capture photoDialog in a stable reference — state won't change during await
      const { rowId, quarter } = photoDialog;
      setRows(prev => prev.map(row => {
        if (row.id !== rowId) return row;
        const q = { ...row[quarter], fotos: [...row[quarter].fotos, ...newPhotos] };
        return { ...row, [quarter]: q };
      }));
      toast({ title: `${newPhotos.length} foto(s) adicionada(s) com sucesso!` });
    } catch {
      toast({ title: "Erro ao processar imagem(ns)", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setUploadingPhotos(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const dialogRow = photoDialog ? rows.find(r => r.id === photoDialog.rowId) : null;
  const dialogPhotos = dialogRow && photoDialog ? dialogRow[photoDialog.quarter].fotos : [];

  const EditableCell = ({ rowId, field, value, quarter, className = "" }: {
    rowId: string; field: any; value: string; quarter?: QuarterKey; className?: string;
  }) => {
    const isEditing = editingCell &&
      editingCell.rowId === rowId &&
      editingCell.field === field &&
      ("quarter" in editingCell ? editingCell.quarter === quarter : !("quarter" in editingCell) || quarter === undefined);

    if (isEditing) {
      return (
        <div className="flex items-center gap-1 min-w-[80px]">
          <Input
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingCell(null); }}
            className="h-6 text-xs px-1 py-0"
            autoFocus
          />
          <button onClick={commitEdit} className="text-primary hover:text-primary/80 shrink-0"><Check className="w-3 h-3" /></button>
          <button onClick={() => setEditingCell(null)} className="text-muted-foreground shrink-0"><X className="w-3 h-3" /></button>
        </div>
      );
    }
    return (
      <button
        onClick={() => startEdit(rowId, field, quarter, value)}
        className={cn("text-left w-full hover:text-primary transition-colors group", className)}
        title="Clique para editar"
      >
        {value || <span className="text-muted-foreground/40 italic text-xs">—</span>}
        <Pencil className="inline w-2.5 h-2.5 ml-1 opacity-0 group-hover:opacity-60" />
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={addRow} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Adicionar Equipamento
        </Button>
      </div>

      {/* Photo dialog */}
      {photoDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4" onClick={() => setPhotoDialog(null)}>
          <div className="bg-card border border-border rounded-lg w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">
                Fotos — {dialogRow?.cod} / {QUARTERS.find(q => q.key === photoDialog.quarter)?.label}
              </h3>
              <button onClick={() => setPhotoDialog(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            {dialogPhotos.length > 0 && (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {dialogPhotos.map(photo => (
                  <div key={photo.id} className="flex items-center gap-2 text-sm border border-border/60 rounded-md px-3 py-2 bg-muted/20">
                    {photo.url.startsWith("data:image") ? (
                      <img src={photo.url} alt={photo.label} className="w-10 h-10 object-cover rounded shrink-0" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-primary shrink-0" />
                    )}
                    <span className="flex-1 text-xs truncate text-muted-foreground" title={photo.label}>
                      {photo.label}
                    </span>
                    {!photo.url.startsWith("data:image") && (
                      <a href={photo.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 shrink-0" title="Abrir link">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button onClick={() => removePhoto(photoDialog.rowId, photoDialog.quarter, photo.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload from device — same compressImage pattern as registrar-os / fechar-os */}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground font-medium">Enviar foto do dispositivo</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  disabled={uploadingPhotos}
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="w-3.5 h-3.5" />
                  Câmera
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  disabled={uploadingPhotos}
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Galeria / PC
                </Button>
                {uploadingPhotos && (
                  <Loader2 className="w-4 h-4 animate-spin text-primary self-center shrink-0" />
                )}
              </div>
              {/* fromCamera=true bypasses isImageFile() — Android OEM browsers deliver file.type="" for camera captures */}
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => void handlePhotoUpload(e.target.files, true)} />
              <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => void handlePhotoUpload(e.target.files, false)} />
            </div>

            {/* Add via external link (existing functionality — unchanged) */}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground font-medium">Ou adicionar link externo (Google Drive, etc.)</p>
              <div className="space-y-2">
                <Input placeholder="URL da foto (Google Drive, Photos, etc.)" value={newPhotoUrl} onChange={e => setNewPhotoUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && addPhoto()} className="text-sm" />
                <Input placeholder="Nome/descrição (opcional)" value={newPhotoLabel} onChange={e => setNewPhotoLabel(e.target.value)} onKeyDown={e => e.key === "Enter" && addPhoto()} className="text-sm" />
                <Button onClick={addPhoto} size="sm" className="w-full gap-2">
                  <Plus className="w-4 h-4" />Adicionar Link
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card className="bg-card border-border/50">
        <CardContent className="p-0 overflow-auto max-h-[calc(100vh-260px)]">
          <table className="w-full text-xs border-collapse" style={{ minWidth: "1600px" }}>
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="bg-muted/40 border-b border-border">
                {colHeader("empresa",  "Empresa",      "text-left px-3 py-2.5 font-semibold text-muted-foreground border-r border-border/40 min-w-[120px]")}
                {colHeader("cod",      "Cod.",          "text-left px-3 py-2.5 font-semibold text-muted-foreground border-r border-border/40 w-20")}
                {colHeader("modelo",   "Modelo",        "text-left px-3 py-2.5 font-semibold text-muted-foreground border-r border-border/40 min-w-[160px]")}
                {colHeader("tensao",   "Tensão (V)",    "text-center px-3 py-2.5 font-semibold text-muted-foreground border-r border-border/40 w-20")}
                {colHeader("btu",      "BTU (s)",       "text-center px-3 py-2.5 font-semibold text-muted-foreground border-r border-border/40 w-20")}
                {colHeader("local",    "Local",         "text-left px-3 py-2.5 font-semibold text-muted-foreground border-r border-border/40 min-w-[150px]")}
                {colHeader("tipoArea", "Tipo de Área",  "text-left px-3 py-2.5 font-semibold text-muted-foreground border-r border-border/40 w-28")}
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground border-r border-border/40 w-24">Link da Ficha</th>
                {QUARTERS.map(q => (
                  <th key={q.key} colSpan={3} className="text-center px-3 py-2.5 font-semibold text-primary border-r border-border/40 bg-primary/5 whitespace-nowrap">
                    {q.label}
                  </th>
                ))}
                {colHeader("observacao", "Observação", "text-left px-3 py-2.5 font-semibold text-muted-foreground min-w-[140px]")}
                <th className="w-10 px-2 text-center">
                  {hasActiveFilters && (
                    <button
                      onClick={() => setColFilters({})}
                      title="Limpar todos os filtros"
                      className="text-[9px] text-destructive hover:text-destructive/80"
                    >
                      ✕
                    </button>
                  )}
                </th>
              </tr>
              <tr className="bg-muted/20 border-b border-border text-[10px] text-muted-foreground sticky-sub-header">
                <th colSpan={8} />
                {QUARTERS.map(q => (
                  <React.Fragment key={q.key}>
                    <th className="text-center px-2 py-1.5 border-r border-border/30 font-normal min-w-[100px]">Execução</th>
                    <th className="text-center px-2 py-1.5 border-r border-border/30 font-normal w-14">OK</th>
                    <th className="text-center px-2 py-1.5 border-r border-border/30 font-normal w-14">Foto</th>
                  </React.Fragment>
                ))}
                <th />
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredRows.map((row) => (
                <tr key={row.id} className="group hover:bg-muted/10 transition-colors">
                  <td className="px-3 py-2 border-r border-border/30">
                    <EditableCell rowId={row.id} field="empresa" value={row.empresa ?? ""} />
                  </td>
                  <td className="px-3 py-2 border-r border-border/30 font-mono font-bold text-primary">
                    <EditableCell rowId={row.id} field="cod" value={row.cod} />
                  </td>
                  <td className="px-3 py-2 border-r border-border/30">
                    <EditableCell rowId={row.id} field="modelo" value={row.modelo} />
                  </td>
                  <td className="px-3 py-2 border-r border-border/30 text-center">
                    <EditableCell rowId={row.id} field="tensao" value={row.tensao} className="text-center" />
                  </td>
                  <td className="px-3 py-2 border-r border-border/30 text-center">
                    <EditableCell rowId={row.id} field="btu" value={row.btu} className="text-center" />
                  </td>
                  <td className="px-3 py-2 border-r border-border/30">
                    <EditableCell rowId={row.id} field="local" value={row.local} />
                  </td>
                  <td className="px-3 py-2 border-r border-border/30">
                    <EditableCell rowId={row.id} field="tipoArea" value={row.tipoArea} />
                  </td>
                  <td className="px-3 py-2 border-r border-border/30">
                    {row.linkFicha ? (
                      <div className="flex items-center gap-1">
                        <a href={row.linkFicha} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono truncate max-w-[70px]">
                          {row.cod}
                        </a>
                        <button onClick={() => startEdit(row.id, "linkFicha", undefined, row.linkFicha)} className="opacity-0 group-hover:opacity-60">
                          <Pencil className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : (
                      <EditableCell rowId={row.id} field="linkFicha" value={row.linkFicha} />
                    )}
                  </td>
                  {QUARTERS.map(q => {
                    const qdata = row[q.key as QuarterKey];
                    return (
                      <React.Fragment key={`${row.id}-${q.key}`}>
                        <td className="px-3 py-2 border-r border-border/30 bg-primary/[0.03]">
                          <EditableCell rowId={row.id} field="execucao" quarter={q.key as QuarterKey} value={qdata.execucao} />
                        </td>
                        <td className="px-2 py-2 border-r border-border/30 text-center bg-primary/[0.03]">
                          <button
                            onClick={() => toggleOk(row.id, q.key as QuarterKey)}
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold transition-colors",
                              qdata.ok
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-600/40"
                                : "bg-muted/40 text-muted-foreground border border-border/40 hover:border-emerald-600/40"
                            )}
                            title="Clique para alternar status"
                          >
                            {qdata.ok ? "OK" : "—"}
                          </button>
                        </td>
                        <td className="px-2 py-2 border-r border-border/30 bg-primary/[0.03] text-center">
                          <button
                            onClick={() => openPhotoDialog(row.id, q.key as QuarterKey)}
                            className={cn(
                              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors mx-auto",
                              qdata.fotos.length > 0
                                ? "bg-primary/15 text-primary border border-primary/30"
                                : "bg-muted/30 text-muted-foreground border border-border/30 hover:border-primary/30"
                            )}
                            title="Gerenciar fotos"
                          >
                            <ImageIcon className="w-3 h-3" />
                            {qdata.fotos.length > 0 ? qdata.fotos.length : "+"}
                          </button>
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td className="px-3 py-2">
                    <EditableCell rowId={row.id} field="observacao" value={row.observacao} />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => removeRow(row.id)}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={22} className="text-center py-10 text-muted-foreground">
                    {rows.length === 0
                      ? "Nenhum equipamento cadastrado. Clique em \"Adicionar Equipamento\" para começar."
                      : "Nenhum equipamento corresponde aos filtros."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        💡 Clique em qualquer célula para editar · Alterações salvas automaticamente · Clique no status para alternar OK · Clique no ícone de foto para gerenciar imagens
      </p>
    </div>
  );
}

export default function Pmoc() {
  const [activeStateTab, setActiveStateTab] = useState<StateTabKey>("amazonas");

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="bg-background border-b border-border/30 shrink-0">
        <div className="px-4 md:px-6 pt-4 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Wind className="w-7 h-7 text-primary" />
            PMOC e Bebedouros
          </h1>
          <p className="text-muted-foreground mt-1">
            Cronograma anual de manutenção preventiva. Alterações salvas automaticamente.
          </p>
        </div>
      </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-4 md:px-6 pb-6 pt-4 space-y-8">

      {/* Tabela Principal */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-primary border-primary/40 font-semibold px-3 py-1">
            Tabela Principal
          </Badge>
        </div>
        <PmocTable storageKey="pmoc_main" initialRows={defaultRows} />
      </div>

      {/* Abas por Estado */}
      <div className="space-y-4">
        <div className="border-b border-border">
          <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
            {STATE_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveStateTab(tab.key)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                  activeStateTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <PmocTable key={activeStateTab} storageKey={`pmoc_state_${activeStateTab}`} initialRows={[]} />
      </div>
    
        </div>
      </div>
    </div>
  );
}
