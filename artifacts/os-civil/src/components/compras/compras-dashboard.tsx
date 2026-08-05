import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ShoppingCart, FileSpreadsheet, Hash, DollarSign } from "lucide-react";
import type { Workbook } from "@/types/purchase-sheet";

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

/** Detect columns whose name suggests a monetary/numeric value. */
function isValueColumn(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("valor") || n.includes("preço") || n.includes("preco")
    || n.includes("total") || n.includes("custo") || n.includes("r$");
}

/** Try to parse a localized number string (e.g. "1.200,50" or "1200.50"). */
function parseNumber(s: string): number {
  if (!s.trim()) return 0;
  // Remove thousand separators (dots) and replace comma decimal
  const clean = s.replace(/[^\d,.-]/g, "").replace(",", ".");
  // If there are multiple dots after removing commas, strip all but last
  const parts = clean.split(".");
  const normalized = parts.length > 2
    ? parts.slice(0, -1).join("") + "." + parts[parts.length - 1]
    : clean;
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

interface Props {
  workbook: Workbook;
  unit: string;
  onClose: () => void;
}

export function ComprasDashboard({ workbook, unit, onClose }: Props) {
  const stats = useMemo(() => {
    const byTab = workbook.tabs.map(tab => {
      const total = tab.rows.length;
      const filled = tab.rows.filter(r => r.some(c => c.trim())).length;

      // Sum any value-named columns
      let valueSum = 0;
      const valCols: number[] = [];
      tab.columns.forEach((col, ci) => { if (isValueColumn(col)) valCols.push(ci); });
      if (valCols.length) {
        tab.rows.forEach(row => valCols.forEach(ci => { valueSum += parseNumber(row[ci] ?? ""); }));
      }

      return { name: tab.name, total, filled, valueSum };
    });

    const totalRows = byTab.reduce((s, t) => s + t.total, 0);
    const filledRows = byTab.reduce((s, t) => s + t.filled, 0);
    const totalValue = byTab.reduce((s, t) => s + t.valueSum, 0);
    const tabs = workbook.tabs.length;

    return { byTab, totalRows, filledRows, totalValue, tabs };
  }, [workbook]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const hasValues = stats.byTab.some(t => t.valueSum > 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div
        className="bg-background rounded-xl border border-border/60 shadow-2xl w-full max-w-4xl my-8 space-y-5 p-6"
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

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <FileSpreadsheet className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Abas</span>
              </div>
              <div className="text-2xl font-bold font-mono text-primary">{stats.tabs}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Hash className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground">Total de Linhas</span>
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-500">{stats.totalRows}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Hash className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-muted-foreground">Linhas Preenchidas</span>
              </div>
              <div className="text-2xl font-bold font-mono text-blue-400">{stats.filledRows}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">Valor Total</span>
              </div>
              <div className="text-lg font-bold font-mono text-amber-500">
                {hasValues ? formatCurrency(stats.totalValue) : <span className="text-sm text-muted-foreground">—</span>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className={`grid gap-4 ${hasValues ? "md:grid-cols-2" : "grid-cols-1"}`}>
          {/* Rows per tab */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Linhas por Aba</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.byTab} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(v: number, name: string) => [v, name === "total" ? "Total" : "Preenchidas"]}
                  />
                  <Bar dataKey="total" name="total" radius={[4, 4, 0, 0]}>
                    {stats.byTab.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                  <Bar dataKey="filled" name="filled" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Value per tab — only shown when value columns exist */}
          {hasValues && (
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Valor por Aba</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.byTab.filter(t => t.valueSum > 0)} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      formatter={(v: number) => [formatCurrency(v), "Valor"]}
                    />
                    <Bar dataKey="valueSum" name="Valor" radius={[4, 4, 0, 0]}>
                      {stats.byTab.filter(t => t.valueSum > 0).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Per-tab detail table */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Detalhe por Aba</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 text-xs text-muted-foreground border-b border-border/50">
                    <th className="text-left px-4 py-2 font-semibold">Aba</th>
                    <th className="text-right px-4 py-2 font-semibold">Linhas Totais</th>
                    <th className="text-right px-4 py-2 font-semibold">Preenchidas</th>
                    <th className="text-right px-4 py-2 font-semibold">%</th>
                    {hasValues && <th className="text-right px-4 py-2 font-semibold">Valor</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {stats.byTab.map((t, i) => (
                    <tr key={i} className="hover:bg-muted/10">
                      <td className="px-4 py-2 font-medium">{t.name}</td>
                      <td className="px-4 py-2 text-right font-mono">{t.total}</td>
                      <td className="px-4 py-2 text-right font-mono text-emerald-500">{t.filled}</td>
                      <td className="px-4 py-2 text-right font-mono text-blue-400">
                        {t.total > 0 ? `${Math.round((t.filled / t.total) * 100)}%` : "—"}
                      </td>
                      {hasValues && (
                        <td className="px-4 py-2 text-right font-mono text-amber-500">
                          {t.valueSum > 0 ? formatCurrency(t.valueSum) : "—"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
