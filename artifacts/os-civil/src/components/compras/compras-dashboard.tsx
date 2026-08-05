import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ShoppingCart, TrendingUp, Users, Package, Filter } from "lucide-react";
import type { Workbook, SheetTab } from "@/types/purchase-sheet";

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#ef4444"];

/* ── Column-name detection helpers ─────────────────────────────────────── */
function colIdx(tab: SheetTab, ...keywords: string[]): number {
  return tab.columns.findIndex(c =>
    keywords.some(k => c.toLowerCase().includes(k.toLowerCase()))
  );
}

function isFornecedorCol(name: string) {
  const n = name.toLowerCase();
  return n.includes("fornec") || n.includes("empresa") || n.includes("vendor");
}
function isSolicitanteCol(name: string) {
  const n = name.toLowerCase();
  return n.includes("solicit") || n.includes("requisi") || n.includes("responsav");
}
function isTipoCol(name: string) {
  const n = name.toLowerCase();
  return n.includes("tipo") || n.includes("categoria") || n.includes("natureza");
}
function isValueCol(name: string) {
  const n = name.toLowerCase();
  return n.includes("valor") || n.includes("preço") || n.includes("preco")
    || n.includes("total") || n.includes("custo") || n.includes("r$");
}

/** Detect which tab category this tab represents (Compras / Serviços / GV / other). */
function tabCategory(name: string): "compras" | "servicos" | "gv" | "other" {
  const n = name.toLowerCase();
  if (n.includes("compra")) return "compras";
  if (n.includes("servi")) return "servicos";
  if (n.includes("gv") || n.includes("gestão de valor") || n.includes("gestao de valor")) return "gv";
  return "other";
}

/** Parse a localized number string (e.g. "1.200,50" → 1200.50). */
function parseNumber(s: string): number {
  if (!s?.trim()) return 0;
  const clean = s.replace(/[^\d,.-]/g, "").replace(",", ".");
  const parts = clean.split(".");
  const normalized = parts.length > 2
    ? parts.slice(0, -1).join("") + "." + parts[parts.length - 1]
    : clean;
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function formatCurrencyShort(v: number) {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
  return formatCurrency(v);
}

/* ── Types ──────────────────────────────────────────────────────────────── */
interface Props {
  workbook: Workbook;
  unit: string;
  onClose: () => void;
}

interface RowRecord {
  fornecedor: string;
  solicitante: string;
  tipo: string;
  tabName: string;
  tabCategory: "compras" | "servicos" | "gv" | "other";
  value: number;
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function ComprasDashboard({ workbook, unit, onClose }: Props) {

  /* Filters */
  const [filterFornecedor, setFilterFornecedor] = useState("__ALL__");
  const [filterSolicitante, setFilterSolicitante] = useState("__ALL__");
  const [filterTipo, setFilterTipo] = useState("__ALL__");
  const [filterTab, setFilterTab] = useState("__ALL__");

  /* Flatten all rows across all tabs into RowRecords */
  const allRows = useMemo<RowRecord[]>(() => {
    const result: RowRecord[] = [];
    for (const tab of workbook.tabs) {
      const fi = tab.columns.findIndex(c => isFornecedorCol(c));
      const si = tab.columns.findIndex(c => isSolicitanteCol(c));
      const ti = tab.columns.findIndex(c => isTipoCol(c));
      const vi = tab.columns.findIndex(c => isValueCol(c));
      const cat = tabCategory(tab.name);

      for (const row of tab.rows) {
        if (!row.some(c => c.trim())) continue; // skip fully-empty rows
        result.push({
          fornecedor: (fi >= 0 ? row[fi] : "") || "",
          solicitante: (si >= 0 ? row[si] : "") || "",
          tipo: (ti >= 0 ? row[ti] : "") || "",
          tabName: tab.name,
          tabCategory: cat,
          value: vi >= 0 ? parseNumber(row[vi] || "") : 0,
        });
      }
    }
    return result;
  }, [workbook]);

  /* Unique option lists for filters */
  const optFornecedores = useMemo(() => [...new Set(allRows.map(r => r.fornecedor))].filter(Boolean).sort(), [allRows]);
  const optSolicitantes = useMemo(() => [...new Set(allRows.map(r => r.solicitante))].filter(Boolean).sort(), [allRows]);
  const optTipos = useMemo(() => [...new Set(allRows.map(r => r.tipo))].filter(Boolean).sort(), [allRows]);
  const optTabs = useMemo(() => workbook.tabs.map(t => t.name), [workbook]);

  /* Filtered rows */
  const filtered = useMemo(() => allRows.filter(r => {
    if (filterFornecedor !== "__ALL__" && r.fornecedor !== filterFornecedor) return false;
    if (filterSolicitante !== "__ALL__" && r.solicitante !== filterSolicitante) return false;
    if (filterTipo !== "__ALL__" && r.tipo !== filterTipo) return false;
    if (filterTab !== "__ALL__" && r.tabName !== filterTab) return false;
    return true;
  }), [allRows, filterFornecedor, filterSolicitante, filterTipo, filterTab]);

  const activeFilters = [filterFornecedor, filterSolicitante, filterTipo, filterTab].filter(f => f !== "__ALL__").length;

  /* KPI cards — classified by "Tipo" cell value first, tab-name detection as fallback */
  function rowTipo(r: RowRecord): "compras" | "servicos" | "gv" | "other" {
    const t = r.tipo.toLowerCase().trim();
    if (t) {
      if (t.includes("compra")) return "compras";
      if (t.includes("servi")) return "servicos";
      if (t.includes("gv") || t.includes("gestão") || t.includes("gestao")) return "gv";
      return "other";
    }
    return r.tabCategory;
  }
  const totalValue   = useMemo(() => filtered.reduce((s, r) => s + r.value, 0), [filtered]);
  const comprasRows  = useMemo(() => filtered.filter(r => rowTipo(r) === "compras"),  [filtered]);  // eslint-disable-line react-hooks/exhaustive-deps
  const servicosRows = useMemo(() => filtered.filter(r => rowTipo(r) === "servicos"), [filtered]);  // eslint-disable-line react-hooks/exhaustive-deps
  const gvRows       = useMemo(() => filtered.filter(r => rowTipo(r) === "gv"),       [filtered]);  // eslint-disable-line react-hooks/exhaustive-deps
  const comprasValue  = useMemo(() => comprasRows.reduce((s, r) => s + r.value, 0),  [comprasRows]);
  const servicosValue = useMemo(() => servicosRows.reduce((s, r) => s + r.value, 0), [servicosRows]);
  const gvValue       = useMemo(() => gvRows.reduce((s, r) => s + r.value, 0),       [gvRows]);
  const hasValues = totalValue > 0;

  /* Aggregation helpers */
  function aggregateBy(key: keyof RowRecord, topN = 10) {
    const map = new Map<string, { count: number; value: number }>();
    for (const r of filtered) {
      const k = (r[key] as string) || "(sem valor)";
      const e = map.get(k) ?? { count: 0, value: 0 };
      e.count++;
      e.value += r.value;
      map.set(k, e);
    }
    return [...map.entries()]
      .map(([name, { count, value }]) => ({ name, count, value }))
      .sort((a, b) => b.value - a.value || b.count - a.count)
      .slice(0, topN);
  }

  const byFornecedor = useMemo(() => aggregateBy("fornecedor"), [filtered]);   // eslint-disable-line react-hooks/exhaustive-deps
  const bySolicitante = useMemo(() => aggregateBy("solicitante"), [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Tab distribution for pie chart */
  const byTab = useMemo(() => {
    const map = new Map<string, { count: number; value: number; cat: string }>();
    for (const r of filtered) {
      const e = map.get(r.tabName) ?? { count: 0, value: 0, cat: r.tabCategory };
      e.count++;
      e.value += r.value;
      map.set(r.tabName, e);
    }
    return [...map.entries()].map(([name, { count, value }]) => ({ name, count, value }));
  }, [filtered]);

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-xl border border-border/60 shadow-2xl w-full max-w-5xl my-8 space-y-5 p-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              Indicadores — Compras e Serviços
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">Unidade: <strong>{unit}</strong></p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Filters */}
        <div className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {activeFilters > 0 && (
              <button
                onClick={() => { setFilterFornecedor("__ALL__"); setFilterSolicitante("__ALL__"); setFilterTipo("__ALL__"); setFilterTab("__ALL__"); }}
                className="ml-auto text-[10px] text-destructive hover:text-destructive/80"
              >
                Limpar {activeFilters} filtro{activeFilters > 1 ? "s" : ""}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {/* Aba */}
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Aba</label>
              <select
                value={filterTab}
                onChange={e => setFilterTab(e.target.value)}
                className="w-full text-xs bg-background border border-border/60 rounded px-2 py-1.5 outline-none focus:border-primary/50"
              >
                <option value="__ALL__">Todas</option>
                {optTabs.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            {/* Fornecedor */}
            {optFornecedores.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Fornecedor</label>
                <select
                  value={filterFornecedor}
                  onChange={e => setFilterFornecedor(e.target.value)}
                  className="w-full text-xs bg-background border border-border/60 rounded px-2 py-1.5 outline-none focus:border-primary/50"
                >
                  <option value="__ALL__">Todos</option>
                  {optFornecedores.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}
            {/* Solicitante */}
            {optSolicitantes.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Solicitante</label>
                <select
                  value={filterSolicitante}
                  onChange={e => setFilterSolicitante(e.target.value)}
                  className="w-full text-xs bg-background border border-border/60 rounded px-2 py-1.5 outline-none focus:border-primary/50"
                >
                  <option value="__ALL__">Todos</option>
                  {optSolicitantes.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}
            {/* Tipo */}
            {optTipos.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Tipo</label>
                <select
                  value={filterTipo}
                  onChange={e => setFilterTipo(e.target.value)}
                  className="w-full text-xs bg-background border border-border/60 rounded px-2 py-1.5 outline-none focus:border-primary/50"
                >
                  <option value="__ALL__">Todos</option>
                  {optTipos.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total Geral</span>
              </div>
              <div className="text-lg font-bold font-mono text-primary">
                {hasValues ? formatCurrencyShort(totalValue) : <span className="text-sm text-muted-foreground">{filtered.length} itens</span>}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{filtered.length} registros</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-muted-foreground">Compras</span>
              </div>
              <div className="text-lg font-bold font-mono text-blue-400">
                {comprasValue > 0 ? formatCurrencyShort(comprasValue) : <span className="text-sm text-muted-foreground">{comprasRows.length} itens</span>}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground">Serviços</span>
              </div>
              <div className="text-lg font-bold font-mono text-emerald-500">
                {servicosValue > 0 ? formatCurrencyShort(servicosValue) : <span className="text-sm text-muted-foreground">{servicosRows.length} itens</span>}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">GV</span>
              </div>
              <div className="text-lg font-bold font-mono text-amber-500">
                {gvValue > 0 ? formatCurrencyShort(gvValue) : <span className="text-sm text-muted-foreground">{gvRows.length} itens</span>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Fornecedores */}
          {byFornecedor.length > 0 && (
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  {hasValues ? "Valor por Fornecedor" : "Itens por Fornecedor"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byFornecedor} layout="vertical" margin={{ top: 5, right: 10, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={hasValues ? formatCurrencyShort : String}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      width={80}
                      tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + "…" : v}
                    />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number, n: string) => [hasValues && n === "value" ? formatCurrency(v) : v, n === "value" ? "Valor" : "Qtd"]}
                    />
                    <Bar dataKey={hasValues ? "value" : "count"} radius={[0, 4, 4, 0]}>
                      {byFornecedor.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Top Solicitantes */}
          {bySolicitante.length > 0 && (
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-500" />
                  {hasValues ? "Valor por Solicitante" : "Itens por Solicitante"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={bySolicitante} layout="vertical" margin={{ top: 5, right: 10, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={hasValues ? formatCurrencyShort : String}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      width={80}
                      tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + "…" : v}
                    />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number, n: string) => [hasValues && n === "value" ? formatCurrency(v) : v, n === "value" ? "Valor" : "Qtd"]}
                    />
                    <Bar dataKey={hasValues ? "value" : "count"} radius={[0, 4, 4, 0]}>
                      {bySolicitante.map((_, i) => <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Distribuição por Aba — pie when only 1 chart shown, else full width */}
          {byTab.length > 1 && (byFornecedor.length === 0 || bySolicitante.length === 0) && (
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Distribuição por Aba</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={byTab} dataKey={hasValues ? "value" : "count"} nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false} fontSize={10}>
                      {byTab.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [hasValues ? formatCurrency(v) : v]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Detail table */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resumo por Aba</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 text-xs text-muted-foreground border-b border-border/50">
                    <th className="text-left px-4 py-2 font-semibold">Aba</th>
                    <th className="text-left px-4 py-2 font-semibold hidden md:table-cell">Categoria</th>
                    <th className="text-right px-4 py-2 font-semibold">Registros</th>
                    {hasValues && <th className="text-right px-4 py-2 font-semibold">Valor</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {byTab.map((t, i) => (
                    <tr key={i} className="hover:bg-muted/10">
                      <td className="px-4 py-2 font-medium">{t.name}</td>
                      <td className="px-4 py-2 hidden md:table-cell">
                        <span className="text-xs text-muted-foreground capitalize">{
                          workbook.tabs.find(tb => tb.name === t.name) ? tabCategory(t.name) === "other" ? "—" : tabCategory(t.name) : "—"
                        }</span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{t.count}</td>
                      {hasValues && (
                        <td className="px-4 py-2 text-right font-mono text-primary">
                          {t.value > 0 ? formatCurrency(t.value) : "—"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                {hasValues && byTab.length > 1 && (
                  <tfoot>
                    <tr className="border-t border-border/60 bg-muted/20 font-semibold text-sm">
                      <td colSpan={2} className="px-4 py-2">Total</td>
                      <td className="px-4 py-2 text-right font-mono">{filtered.length}</td>
                      <td className="px-4 py-2 text-right font-mono text-primary">{formatCurrency(totalValue)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
