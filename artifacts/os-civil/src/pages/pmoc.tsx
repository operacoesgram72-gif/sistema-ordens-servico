import React, { useState, useEffect, useCallback } from "react";
import { Wind, Link as LinkIcon, Plus, Trash2, ExternalLink, Pencil, Check, X, Image as ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
  | { rowId: string; field: "cod" | "modelo" | "tensao" | "btu" | "local" | "tipoArea" | "linkFicha" | "observacao" }
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
    id: genId(), cod: "AR001", modelo: "SPLIT DUTO DAIKIN", tensao: "220", btu: "48.000",
    local: "TRANSMISSORES 01", tipoArea: "ESTRATÉGICO", linkFicha: "",
    q1: { execucao: "Fevereiro", ok: true, fotos: [] },
    q2: { execucao: "Maio", ok: true, fotos: [] },
    q3: { execucao: "Agosto", ok: false, fotos: [] },
    q4: { execucao: "Novembro", ok: false, fotos: [] },
    observacao: "",
  },
  {
    id: genId(), cod: "AR002", modelo: "CASSETE DAIKIN", tensao: "220", btu: "36.000",
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
}

interface PmocTableProps {
  storageKey: string;
  initialRows?: PmocRow[];
}

function PmocTable({ storageKey, initialRows = [] }: PmocTableProps) {
  const { toast } = useToast();
  const [rows, setRowsRaw] = useState<PmocRow[]>(() => loadRows(storageKey, initialRows));
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [editValue, setEditValue] = useState("");
  const [photoDialog, setPhotoDialog] = useState<PhotoDialogState>(null);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newPhotoLabel, setNewPhotoLabel] = useState("");

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
      id: genId(), cod: nextCod, modelo: "", tensao: "220", btu: "",
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
      const q = { ...row[quarter], ok: !row[quarter].ok };
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPhotoDialog(null)}>
          <div className="bg-card border border-border rounded-lg w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
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
                    <ImageIcon className="w-4 h-4 text-primary shrink-0" />
                    <a href={photo.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-primary hover:underline truncate" title={photo.url}>
                      {photo.label}
                    </a>
                    <button onClick={() => removePhoto(photoDialog.rowId, photoDialog.quarter, photo.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground font-medium">Adicionar novo link de foto</p>
              <div className="space-y-2">
                <Input placeholder="URL da foto (Google Drive, Photos, etc.)" value={newPhotoUrl} onChange={e => setNewPhotoUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && addPhoto()} className="text-sm" />
                <Input placeholder="Nome/descrição (opcional)" value={newPhotoLabel} onChange={e => setNewPhotoLabel(e.target.value)} onKeyDown={e => e.key === "Enter" && addPhoto()} className="text-sm" />
                <Button onClick={addPhoto} size="sm" className="w-full gap-2">
                  <Plus className="w-4 h-4" />Adicionar Foto
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card className="bg-card border-border/50">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs border-collapse" style={{ minWidth: "1600px" }}>
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground border-r border-border/40 whitespace-nowrap w-20">Cod.</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground border-r border-border/40 min-w-[160px]">Modelo</th>
                <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-r border-border/40 w-20">Tensão (V)</th>
                <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-r border-border/40 w-20">BTU (s)</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground border-r border-border/40 min-w-[150px]">Local</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground border-r border-border/40 w-28">Tipo de Área</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground border-r border-border/40 w-24">Link da Ficha</th>
                {QUARTERS.map(q => (
                  <th key={q.key} colSpan={3} className="text-center px-3 py-2.5 font-semibold text-primary border-r border-border/40 bg-primary/5 whitespace-nowrap">
                    {q.label}
                  </th>
                ))}
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground min-w-[140px]">Observação</th>
                <th className="w-10" />
              </tr>
              <tr className="bg-muted/20 border-b border-border text-[10px] text-muted-foreground">
                <th colSpan={7} />
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
              {rows.map((row) => (
                <tr key={row.id} className="group hover:bg-muted/10 transition-colors">
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
              {rows.length === 0 && (
                <tr>
                  <td colSpan={24} className="text-center py-10 text-muted-foreground">
                    Nenhum equipamento cadastrado. Clique em "Adicionar Equipamento" para começar.
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
    <div className="p-4 md:p-6 w-full max-w-full space-y-8">
      <div className="flex items-center justify-between">
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

        {STATE_TABS.map(tab => (
          <div key={tab.key} className={cn(activeStateTab === tab.key ? "block" : "hidden")}>
            <PmocTable storageKey={`pmoc_state_${tab.key}`} initialRows={[]} />
          </div>
        ))}
      </div>
    </div>
  );
}
