import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Plus, Trash2, Pencil, Check, X, ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Workbook, SheetTab } from "@/types/purchase-sheet";
import { emptyTab } from "@/types/purchase-sheet";

// Returns true when value looks like an absolute http/https URL.
function isAbsoluteUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Detect if a column header is an "attachment" / URL column.
// The column name must contain "anexo" or "link" or "url" (case-insensitive)
// for its cells to be auto-rendered as clickable links.
function isLinkColumn(colName: string): boolean {
  const n = colName.toLowerCase();
  return n.includes("anexo") || n === "link" || n === "url" || n === "links";
}

type SheetGridProps = {
  workbook: Workbook;
  onChange?: (next: Workbook) => void;
  activeTabId: string;
  onActiveTabChange: (id: string) => void;
};

// Fully editable, multi-tab spreadsheet grid. When `onChange` is omitted, the
// grid renders in read-only mode (used by the public share link).
export function SheetGrid({ workbook, onChange, activeTabId, onActiveTabChange }: SheetGridProps) {
  const readOnly = !onChange;
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  // columnFilters: keyed by column index within the active tab
  const [columnFilters, setColumnFilters] = useState<Record<number, string>>({});
  // colWidths: per-column pixel width overrides (drag-to-resize)
  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const resizingRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);

  const onResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { colIdx, startX, startWidth } = resizingRef.current;
    const newWidth = Math.max(60, startWidth + e.clientX - startX);
    setColWidths(prev => ({ ...prev, [colIdx]: newWidth }));
  }, []);

  const onResizeEnd = useCallback(() => {
    resizingRef.current = null;
    document.removeEventListener("mousemove", onResizeMove);
    document.removeEventListener("mouseup", onResizeEnd);
  }, [onResizeMove]);

  const onResizeStart = useCallback((e: React.MouseEvent, colIdx: number) => {
    const th = (e.currentTarget as HTMLElement).closest("th") as HTMLElement;
    resizingRef.current = { colIdx, startX: e.clientX, startWidth: th.offsetWidth };
    document.addEventListener("mousemove", onResizeMove);
    document.addEventListener("mouseup", onResizeEnd);
    e.preventDefault();
    e.stopPropagation();
  }, [onResizeMove, onResizeEnd]);

  const activeTab = workbook.tabs.find((t) => t.id === activeTabId) ?? workbook.tabs[0];

  // Reset column filters and widths when the active tab changes
  useEffect(() => { setColumnFilters({}); setColWidths({}); }, [activeTabId]);

  // Unique values per column for filter datalist suggestions
  const uniqueValsByColumn = useMemo(() => {
    if (!activeTab) return {} as Record<number, string[]>;
    return activeTab.columns.reduce((acc, _, ci) => {
      acc[ci] = [...new Set(activeTab.rows.map(r => r[ci] ?? "").filter(Boolean))].sort();
      return acc;
    }, {} as Record<number, string[]>);
  }, [activeTab]);

  // Client-side filtered rows — does not affect persisted data
  const filteredRows = useMemo(() => {
    if (!activeTab) return [];
    const hasFilter = Object.values(columnFilters).some((v) => v.trim() !== "");
    if (!hasFilter) return activeTab.rows.map((row, idx) => ({ row, idx }));
    return activeTab.rows
      .map((row, idx) => ({ row, idx }))
      .filter(({ row }) =>
        Object.entries(columnFilters).every(([colIdxStr, filterVal]) => {
          if (!filterVal.trim()) return true;
          const colIdx = Number(colIdxStr);
          return (row[colIdx] ?? "").toLowerCase().includes(filterVal.toLowerCase());
        })
      );
  }, [activeTab, columnFilters]);

  const updateTab = (tabId: string, updater: (tab: SheetTab) => SheetTab) => {
    if (!onChange) return;
    onChange({ tabs: workbook.tabs.map((t) => (t.id === tabId ? updater(t) : t)) });
  };

  const addTab = () => {
    if (!onChange) return;
    const tab = emptyTab(`Nova Aba ${workbook.tabs.length + 1}`);
    onChange({ tabs: [...workbook.tabs, tab] });
    onActiveTabChange(tab.id);
  };

  const deleteTab = (tabId: string) => {
    if (!onChange) return;
    if (workbook.tabs.length <= 1) return;
    if (!window.confirm("Remover esta aba e todos os seus dados?")) return;
    const remaining = workbook.tabs.filter((t) => t.id !== tabId);
    onChange({ tabs: remaining });
    if (activeTabId === tabId) onActiveTabChange(remaining[0].id);
  };

  const startRename = (tab: SheetTab) => {
    setRenamingTabId(tab.id);
    setRenameValue(tab.name);
  };
  const confirmRename = () => {
    if (renamingTabId && renameValue.trim()) {
      updateTab(renamingTabId, (t) => ({ ...t, name: renameValue.trim() }));
    }
    setRenamingTabId(null);
  };

  const addColumn = () => {
    updateTab(activeTab.id, (t) => ({
      ...t,
      columns: [...t.columns, `Coluna ${t.columns.length + 1}`],
      rows: t.rows.map((r) => [...r, ""]),
    }));
  };
  const deleteColumn = (colIdx: number) => {
    if (activeTab.columns.length <= 1) return;
    if (!window.confirm("Remover esta coluna?")) return;
    updateTab(activeTab.id, (t) => ({
      ...t,
      columns: t.columns.filter((_, i) => i !== colIdx),
      rows: t.rows.map((r) => r.filter((_, i) => i !== colIdx)),
    }));
  };
  const renameColumn = (colIdx: number, value: string) => {
    updateTab(activeTab.id, (t) => ({
      ...t,
      columns: t.columns.map((c, i) => (i === colIdx ? value : c)),
    }));
  };

  const addRow = () => {
    updateTab(activeTab.id, (t) => ({
      ...t,
      rows: [...t.rows, Array(t.columns.length).fill("")],
    }));
  };
  const deleteRow = (rowIdx: number) => {
    updateTab(activeTab.id, (t) => ({
      ...t,
      rows: t.rows.filter((_, i) => i !== rowIdx),
    }));
  };
  const setCell = (rowIdx: number, colIdx: number, value: string) => {
    updateTab(activeTab.id, (t) => ({
      ...t,
      rows: t.rows.map((r, ri) => (ri === rowIdx ? r.map((c, ci) => (ci === colIdx ? value : c)) : r)),
    }));
  };

  if (!activeTab) return null;

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/50 pb-2">
        {workbook.tabs.map((tab) => (
          <div
            key={tab.id}
            className={`group flex items-center gap-1 rounded-md px-3 py-1.5 text-sm cursor-pointer transition-colors ${
              tab.id === activeTabId ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50"
            }`}
            onClick={() => onActiveTabChange(tab.id)}
          >
            {renamingTabId === tab.id ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmRename(); if (e.key === "Escape") setRenamingTabId(null); }}
                  className="h-6 w-32 text-xs px-1.5"
                />
                <button onClick={confirmRename} className="text-emerald-500 hover:text-emerald-400"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setRenamingTabId(null)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <>
                <span>{tab.name}</span>
                {!readOnly && (
                  <span className="hidden group-hover:flex items-center gap-1 ml-1">
                    <button onClick={(e) => { e.stopPropagation(); startRename(tab); }} className="text-muted-foreground hover:text-foreground" title="Renomear aba">
                      <Pencil className="w-3 h-3" />
                    </button>
                    {workbook.tabs.length > 1 && (
                      <button onClick={(e) => { e.stopPropagation(); deleteTab(tab.id); }} className="text-muted-foreground hover:text-destructive" title="Remover aba">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                )}
              </>
            )}
          </div>
        ))}
        {!readOnly && (
          <Button variant="ghost" size="sm" onClick={addTab} className="gap-1 text-muted-foreground h-7">
            <Plus className="w-3.5 h-3.5" />Nova Aba
          </Button>
        )}
      </div>

      {/* Grid */}
      <div className="border border-border/50 rounded-md overflow-auto bg-card">
        <table className="border-collapse w-full text-sm">
          <thead>
            {/* Column names row */}
            <tr>
              <th className="w-10 border-b border-r border-border/50 bg-muted/30 no-print-controls" />
              {activeTab.columns.map((col, colIdx) => (
                <th
                  key={colIdx}
                  className="border-b border-r border-border/50 bg-muted/30 p-0 relative"
                  style={{ width: colWidths[colIdx] ?? undefined, minWidth: colWidths[colIdx] ?? 140 }}
                >
                  <div className="flex items-center gap-1 px-1.5 py-1 pr-2">
                    {readOnly ? (
                      <span className="font-semibold text-xs flex-1 truncate">{col}</span>
                    ) : (
                      <input
                        value={col}
                        onChange={(e) => renameColumn(colIdx, e.target.value)}
                        className="flex-1 bg-transparent font-semibold text-xs px-1 py-0.5 outline-none focus:bg-background rounded"
                      />
                    )}
                    {!readOnly && activeTab.columns.length > 1 && (
                      <button onClick={() => deleteColumn(colIdx)} className="text-muted-foreground/50 hover:text-destructive shrink-0 no-print-controls" title="Remover coluna">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {/* Drag-to-resize handle — right edge of header */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 no-print-controls select-none"
                    onMouseDown={(e) => onResizeStart(e, colIdx)}
                    title="Arrastar para redimensionar"
                  />
                </th>
              ))}
              {!readOnly && (
                <th className="border-b border-border/50 bg-muted/30 w-10 no-print-controls">
                  <button onClick={addColumn} className="flex items-center justify-center w-full h-full text-muted-foreground hover:text-primary py-1.5" title="Adicionar coluna">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </th>
              )}
            </tr>
            {/* Column filter inputs row — hidden in print; datalist provides Excel-style unique-value suggestions */}
            <tr className="no-print">
              <th className="w-10 border-b border-r border-border/50 bg-background/50">
                <Search className="w-3 h-3 text-muted-foreground/40 mx-auto" />
              </th>
              {activeTab.columns.map((_, colIdx) => (
                <th key={colIdx} className="border-b border-r border-border/50 bg-background/50 p-1" style={{ minWidth: colWidths[colIdx] ?? 140 }}>
                  <input
                    list={`sg-filter-${activeTabId}-${colIdx}`}
                    value={columnFilters[colIdx] ?? ""}
                    onChange={(e) =>
                      setColumnFilters((prev) => ({ ...prev, [colIdx]: e.target.value }))
                    }
                    placeholder="▾ Filtrar…"
                    className="w-full bg-transparent text-xs px-1.5 py-0.5 outline-none border border-border/40 rounded focus:border-primary/50 placeholder:text-muted-foreground/30"
                  />
                  <datalist id={`sg-filter-${activeTabId}-${colIdx}`}>
                    {(uniqueValsByColumn[colIdx] ?? []).map(v => <option key={v} value={v} />)}
                  </datalist>
                </th>
              ))}
              {!readOnly && <th className="border-b border-border/50 bg-background/50" />}
            </tr>
          </thead>
          <tbody>
            {activeTab.rows.length === 0 ? (
              <tr>
                <td colSpan={activeTab.columns.length + 2} className="text-center text-muted-foreground text-xs py-8">
                  Nenhuma linha. {!readOnly && "Clique em \"+ Linha\" para começar."}
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={activeTab.columns.length + 2} className="text-center text-muted-foreground text-xs py-8">
                  Nenhuma linha corresponde aos filtros.
                </td>
              </tr>
            ) : (
              filteredRows.map(({ row, idx: rowIdx }) => (
                <tr key={rowIdx} className="hover:bg-muted/20">
                  <td className="border-r border-b border-border/50 text-center text-[11px] text-muted-foreground/70 no-print-controls">
                    {!readOnly ? (
                      <button onClick={() => deleteRow(rowIdx)} className="w-full py-1 hover:text-destructive" title="Remover linha">
                        {rowIdx + 1}
                      </button>
                    ) : (
                      <span className="py-1 block">{rowIdx + 1}</span>
                    )}
                  </td>
                  {row.map((cell, colIdx) => {
                    const colName = activeTab.columns[colIdx] ?? "";
                    const linkCol = isLinkColumn(colName);
                    const cellIsUrl = linkCol && isAbsoluteUrl(cell);
                    return (
                      <td key={colIdx} className="border-r border-b border-border/50 p-0">
                        {readOnly ? (
                          <div className="px-2 py-1.5 text-xs min-h-[30px] break-words whitespace-pre-wrap">
                            {cellIsUrl ? (
                              <a
                                href={cell}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline break-all"
                                onClick={e => e.stopPropagation()}
                              >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="break-all">{cell}</span>
                              </a>
                            ) : (
                              cell || <span className="text-muted-foreground/40">—</span>
                            )}
                          </div>
                        ) : (
                          <textarea
                            value={cell}
                            rows={1}
                            onChange={(e) => setCell(rowIdx, colIdx, e.target.value)}
                            onInput={(e) => {
                              const el = e.currentTarget;
                              el.style.height = "auto";
                              el.style.height = `${el.scrollHeight}px`;
                            }}
                            ref={(el) => {
                              if (el) {
                                el.style.height = "auto";
                                el.style.height = `${el.scrollHeight}px`;
                              }
                            }}
                            className={`w-full bg-transparent px-2 py-1.5 text-xs outline-none focus:bg-primary/5 resize-none overflow-hidden break-words whitespace-pre-wrap min-h-[30px] ${linkCol && cell && !isAbsoluteUrl(cell) ? "text-amber-500/80" : linkCol && cellIsUrl ? "text-primary" : ""}`}
                            placeholder={linkCol ? "https://..." : undefined}
                            title={linkCol && cell && !isAbsoluteUrl(cell) ? "URL inválida — use https://..." : undefined}
                          />
                        )}
                      </td>
                    );
                  })}
                  {!readOnly && <td className="border-b border-border/50 no-print-controls" />}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />Adicionar Linha
        </Button>
      )}
    </div>
  );
}
