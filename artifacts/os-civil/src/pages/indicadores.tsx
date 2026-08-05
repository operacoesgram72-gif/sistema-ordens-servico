import { useState, useEffect, useCallback, useMemo } from "react";
import { useGetDashboardIndicators } from "@workspace/api-client-react";
import { useUnit } from "@/contexts/unit-context";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, Legend, LabelList,
} from "recharts";
import { ClipboardList, CheckCircle2, DollarSign, TrendingUp, Target, Calendar, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import IndicadoresTimeline from "@/components/indicadores-timeline";

const MONTHS = [
  "Todos", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const FORMATO_LABELS: Record<string, string> = {
  civil: "Civil",
  refrigeracao: "Refrigeração",
  hidraulica: "Hidráulica",
  mecanica: "Mecânica",
  eletrica: "Elétrica",
  outros: "Outros",
};

const TIPO_LABELS: Record<string, string> = {
  reforma: "Reforma",
  revitalizacao: "Revitalização",
  preventiva: "Preventiva",
  corretiva: "Corretiva",
  outros: "Outros",
};

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

function todayISO() {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

export default function Indicadores() {
  const currentYear = new Date().getFullYear();
  const [periodMode, setPeriodMode] = useState<"ano" | "mes" | "dia">("ano");
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [years, setYears] = useState<number[]>([currentYear]);

  // Desempenho filters — formato/tipo are server-side; técnico is client-side
  const [filterFormato, setFilterFormato] = useState<string>("all");
  const [filterTipo, setFilterTipo]       = useState<string>("all");
  const [filterTecnico, setFilterTecnico] = useState<string>("all");

  const { unit } = useUnit();
  const queryClient = useQueryClient();

  useEffect(() => {
    fetch(`${BASE_URL}/api/service-orders/available-years`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: number[] | null) => {
        if (Array.isArray(data) && data.length > 0) {
          setYears(data);
          if (!data.includes(selectedYear)) setSelectedYear(data[0]);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  // Reset client-side technician filter whenever any server-side filter or period changes
  // so a previously selected technician doesn't silently remain when the dataset changes.
  useEffect(() => {
    setFilterTecnico("all");
  }, [filterFormato, filterTipo, selectedYear, selectedMonth, selectedDate, unit, periodMode]);

  const isDiaMode = periodMode === "dia";

  // Build query params — include server-side filters when set
  const queryParams = useMemo(() => {
    const p: Record<string, any> = isDiaMode
      ? { year: selectedYear, unidade: unit, date: selectedDate }
      : { year: selectedYear, unidade: unit };
    if (filterFormato !== "all") p.formatoServico = filterFormato;
    if (filterTipo    !== "all") p.tipo = filterTipo;
    return p;
  }, [isDiaMode, selectedYear, unit, selectedDate, filterFormato, filterTipo]);

  const { data: indicators, isLoading } = useGetDashboardIndicators(
    queryParams as any,
    {
      query: {
        enabled: true,
        queryKey: [
          "dashboard-indicators",
          selectedYear, unit,
          filterFormato, filterTipo,
          ...(isDiaMode ? ["dia", selectedDate] : []),
        ],
      },
    }
  );

  // Derive technician list from returned data for the Técnico filter dropdown
  const allTechnicians = useMemo<string[]>(() => {
    const rows: any[] = (indicators as any)?.byTechnician ?? [];
    return [...new Set(rows.map((r: any) => r.technicianName).filter(Boolean))].sort() as string[];
  }, [indicators]);

  // Client-side technician filter applied on top of server-aggregated data
  const byTechnicianFiltered = useMemo<any[]>(() => {
    const rows: any[] = (indicators as any)?.byTechnician ?? [];
    if (filterTecnico === "all") return rows;
    return rows.filter((r: any) => r.technicianName === filterTecnico);
  }, [indicators, filterTecnico]);

  const hasActiveFilter = filterFormato !== "all" || filterTipo !== "all" || filterTecnico !== "all";

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!indicators) return <div className="p-8">Nenhum dado encontrado.</div>;

  const filteredMonths = selectedMonth === 0
    ? indicators.byMonth
    : indicators.byMonth.filter((_: any, i: number) => i === selectedMonth - 1);

  const totalOs = filteredMonths.reduce((acc: number, curr: any) => acc + curr.total, 0);
  const totalCompleted = filteredMonths.reduce((acc: number, curr: any) => acc + curr.completed, 0);
  const totalValue = filteredMonths.reduce((acc: number, curr: any) => acc + (curr.value ?? 0), 0);
  const completionRate = totalOs > 0 ? (totalCompleted / totalOs) * 100 : 0;
  const avgValue = totalOs > 0 ? totalValue / totalOs : 0;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-background border-b border-border/30 shrink-0">
        <div className="px-6 md:px-8 pt-6 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Indicadores de Desempenho</h1>
          <p className="text-muted-foreground mt-1">Métricas e acompanhamento financeiro do período selecionado.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["dashboard-indicators"] })}
            title="Atualizar indicadores"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Select
            value={periodMode}
            onValueChange={(val) => {
              const mode = val as "ano" | "mes" | "dia";
              setPeriodMode(mode);
              if (mode !== "mes") setSelectedMonth(0);
            }}
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ano">Ano</SelectItem>
              <SelectItem value="mes">Mês</SelectItem>
              <SelectItem value="dia">Dia</SelectItem>
            </SelectContent>
          </Select>
          {isDiaMode ? (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
          ) : (
            <>
              <Select
                value={selectedYear.toString()}
                onValueChange={(val) => setSelectedYear(parseInt(val))}
              >
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {periodMode === "mes" && (
                <Select
                  value={selectedMonth.toString()}
                  onValueChange={(val) => setSelectedMonth(parseInt(val))}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.slice(1).map((m, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
        </div>
        {/* ── Filtros de Desempenho — parte do cabeçalho fixo ─────────────── */}
        <div className="px-6 md:px-8 py-2 border-t border-border/20 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground font-medium">Filtros de Desempenho:</span>
          <Select
            value={filterFormato}
            onValueChange={(v) => setFilterFormato(v)}
          >
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue placeholder="Formato de Serviço" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os formatos</SelectItem>
              {Object.entries(FORMATO_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filterTipo}
            onValueChange={(v) => setFilterTipo(v)}
          >
            <SelectTrigger className="w-40 h-9 text-sm">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(TIPO_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filterTecnico}
            onValueChange={(v) => setFilterTecnico(v)}
          >
            <SelectTrigger className="w-48 h-9 text-sm">
              <SelectValue placeholder="Técnico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os técnicos</SelectItem>
              {allTechnicians.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-xs text-muted-foreground"
              onClick={() => { setFilterFormato("all"); setFilterTipo("all"); setFilterTecnico("all"); }}
            >
              <X className="w-3 h-3 mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>
      </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-6 md:px-8 pb-8 pt-4 max-w-7xl mx-auto space-y-6">

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              <div className="text-sm font-medium text-muted-foreground">
                {isDiaMode
                  ? `Total — ${selectedDate.split("-").reverse().join("/")}`
                  : selectedMonth === 0
                  ? "Total de OS no Ano"
                  : `Total — ${MONTHS[selectedMonth]}`}
              </div>
            </div>
            <div className="text-3xl font-bold font-mono text-primary">{totalOs}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <div className="text-sm font-medium text-muted-foreground">OS Concluídas</div>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-500">{totalCompleted}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-blue-400" />
              <div className="text-sm font-medium text-muted-foreground">Taxa de Conclusão</div>
            </div>
            <div className="text-3xl font-bold font-mono text-blue-400">{completionRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-amber-500" />
              <div className="text-sm font-medium text-muted-foreground">Valor Total Estimado</div>
            </div>
            <div className="text-2xl font-bold font-mono text-amber-500">{formatCurrency(totalValue)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-violet-500" />
              <div className="text-sm font-medium text-muted-foreground">Ticket Médio por OS</div>
            </div>
            <div className="text-2xl font-bold font-mono text-violet-500">{formatCurrency(avgValue)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm font-medium text-muted-foreground">Período Selecionado</div>
            </div>
            <div className="text-lg font-bold">
              {isDiaMode
                ? selectedDate.split("-").reverse().join("/")
                : `${selectedYear}${selectedMonth > 0 ? ` — ${MONTHS[selectedMonth]}` : " (ano completo)"}`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border/50">
          <CardHeader><CardTitle className="text-base">Volume Mensal de OS</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={filteredMonths} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Concluídas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="value" name="Valor (R$)" stroke="#f59e0b" dot={false} strokeWidth={2} yAxisId={0} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader><CardTitle className="text-base">Top 10 Locais</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                layout="vertical"
                data={indicators.byLocation.slice(0, 10)}
                margin={{ top: 5, right: 48, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="location"
                  type="category"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  width={130}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => v.length > 20 ? v.slice(0, 18) + "…" : v}
                />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                  cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                  formatter={(v: number) => [v, "Ordens de Serviço"]}
                />
                <Bar dataKey="count" name="OS" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                  <LabelList
                    dataKey="count"
                    position="right"
                    style={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Por Especialidade ──────────────────────────────────────────────── */}
      {(indicators as any).byFormat && (indicators as any).byFormat.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader><CardTitle className="text-base">Por Especialidade</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Formato</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Concluídas</TableHead>
                    <TableHead className="text-right">Taxa</TableHead>
                    <TableHead className="text-right">Valor Est.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(indicators as any).byFormat.map((row: any) => (
                    <TableRow key={row.format}>
                      <TableCell className="font-medium">{row.format}</TableCell>
                      <TableCell className="text-right font-mono">{row.total}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-500">{row.completed}</TableCell>
                      <TableCell className="text-right font-mono">
                        {row.total > 0 ? `${Math.round((row.completed / row.total) * 100)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-amber-500">{formatCurrency(row.value ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Desempenho por Técnico ─────────────────────────────────────────── */}
      {(indicators as any).byTechnician && (indicators as any).byTechnician.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Desempenho por Técnico</CardTitle>
              {hasActiveFilter && (
                <span className="text-xs text-muted-foreground">
                  {byTechnicianFiltered.length} de {(indicators as any).byTechnician.length} técnico(s)
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Técnico</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Concluídas</TableHead>
                    <TableHead className="text-right">Taxa</TableHead>
                    <TableHead className="text-right">Valor Est.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byTechnicianFiltered.length > 0 ? (
                    byTechnicianFiltered.map((row: any) => (
                      <TableRow key={row.technicianName}>
                        <TableCell className="font-medium">{row.technicianName || "Não atribuído"}</TableCell>
                        <TableCell className="text-right font-mono">{row.total}</TableCell>
                        <TableCell className="text-right font-mono text-emerald-500">{row.completed}</TableCell>
                        <TableCell className="text-right font-mono">
                          {row.total > 0 ? `${Math.round((row.completed / row.total) * 100)}%` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-amber-500">{formatCurrency(row.estimatedValue ?? 0)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        Nenhum resultado para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Timeline de Eventos ────────────────────────────────────────────── */}
      {/* Purely additive — standalone card, does not alter any section above. */}
      <IndicadoresTimeline />
    
        </div>
      </div>
    </div>
  );
}
