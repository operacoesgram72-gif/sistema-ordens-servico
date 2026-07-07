import { useGetDashboardSummary, useGetDashboardStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { ClipboardList, CheckCircle2, Clock, AlertTriangle, CalendarDays, MapPin, RefreshCw } from "lucide-react";
import { PRIORITY_LABELS } from "@/lib/constants";
import { useState, useEffect, useCallback } from "react";
import { useUnit } from "@/contexts/unit-context";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const PIE_COLORS = {
  baixa: "hsl(142 70% 45%)",
  media: "hsl(45 93% 47%)",
  alta: "hsl(24 98% 50%)",
  urgente: "hsl(0 84% 60%)"
};

const MONTHS = [
  "Todos", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const REGIONAL_UNITS = ["AM", "AC", "AP", "RO", "RR", "PA"];

export default function Dashboard() {
  const { unit } = useUnit();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  const [period, setPeriod] = useState<"daily" | "monthly" | "annual">("monthly");
  const [filterYear, setFilterYear] = useState<string>(currentYear.toString());
  const [filterMonth, setFilterMonth] = useState<string>("0");
  const [filterDay, setFilterDay] = useState<string>("0");
  const [filterUnit, setFilterUnit] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);

  const [years, setYears] = useState<number[]>(
    Array.from({ length: 5 }, (_, i) => currentYear - i)
  );

  const isAM = unit === "AM";
  // Effective unit for API calls: AM can filter by sub-unit; other units always see themselves
  const effectiveUnit = isAM
    ? (filterUnit === "all" ? undefined : filterUnit)
    : unit;

  const summaryQueryKey = ["dashboard-summary", effectiveUnit];
  const statsQueryKey = ["dashboard-stats", period];

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary(
    { unidade: effectiveUnit } as any,
    { query: { enabled: true, queryKey: summaryQueryKey } }
  );
  const { data: stats, isLoading: loadingStats } = useGetDashboardStats(
    { period },
    { query: { enabled: true, queryKey: statsQueryKey } }
  );

  useEffect(() => {
    fetch(`${BASE_URL}/api/service-orders/available-years`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: number[] | null) => {
        if (Array.isArray(data) && data.length > 0) setYears(data);
      })
      .catch(() => {});
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: summaryQueryKey }),
      queryClient.invalidateQueries({ queryKey: statsQueryKey }),
    ]);
    setRefreshing(false);
  }, [queryClient, JSON.stringify(summaryQueryKey), JSON.stringify(statsQueryKey)]);

  const daysInMonth = filterMonth !== "0"
    ? new Date(parseInt(filterYear), parseInt(filterMonth), 0).getDate()
    : 31;
  const dayOptions = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const filterLabel = [
    filterYear,
    filterMonth !== "0" ? MONTHS[parseInt(filterMonth)] : null,
    filterDay !== "0" ? `dia ${filterDay}` : null,
  ].filter(Boolean).join(" — ");

  if (loadingSummary || loadingStats) {
    return <div className="p-8 flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (!summary) return null;

  const unitLabel = isAM && filterUnit !== "all" ? ` — ${filterUnit}` : isAM ? " — Todas as Unidades" : ` — ${unit}`;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Painel de Controle</h1>
            <p className="text-muted-foreground mt-1">
              Visão geral das operações e serviços{unitLabel}.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm shrink-0 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2" title="Atualizar dados">
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <div className="bg-card border border-border px-4 py-2 rounded-md">
              <span className="text-muted-foreground">Hoje:</span>
              <span className="font-mono font-bold text-primary ml-1">{summary.totalToday}</span>
            </div>
            <div className="bg-card border border-border px-4 py-2 rounded-md">
              <span className="text-muted-foreground">Este Mês:</span>
              <span className="font-mono font-bold text-primary ml-1">{summary.totalThisMonth}</span>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 bg-card border border-border/50 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground shrink-0">
            <CalendarDays className="w-4 h-4 text-primary" />
            Período:
          </div>
          <Select value={filterYear} onValueChange={(v) => { setFilterYear(v); setFilterMonth("0"); setFilterDay("0"); }}>
            <SelectTrigger className="w-28 h-8 text-sm">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterMonth} onValueChange={(v) => { setFilterMonth(v); setFilterDay("0"); }}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterDay} onValueChange={setFilterDay} disabled={filterMonth === "0"}>
            <SelectTrigger className="w-28 h-8 text-sm">
              <SelectValue placeholder="Dia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Todos</SelectItem>
              {dayOptions.map(d => <SelectItem key={d} value={d.toString()}>Dia {d}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* UF filter — only for AM (main office) */}
          {isAM && (
            <>
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground shrink-0 ml-2 pl-2 border-l border-border">
                <MapPin className="w-4 h-4 text-primary" />
                UF:
              </div>
              <Select value={filterUnit} onValueChange={setFilterUnit}>
                <SelectTrigger className="w-32 h-8 text-sm">
                  <SelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {REGIONAL_UNITS.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {(filterMonth !== "0" || filterDay !== "0") && (
            <>
              <span className="text-xs text-primary font-medium">
                Exibindo: {filterLabel}
              </span>
              <button
                onClick={() => { setFilterMonth("0"); setFilterDay("0"); }}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Limpar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Abertas</CardTitle>
            <ClipboardList className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{summary.totalOpen}</div>
            <p className="text-xs text-muted-foreground mt-1">Aguardando atendimento</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Andamento</CardTitle>
            <Clock className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-yellow-500">{summary.totalInProgress}</div>
            <p className="text-xs text-muted-foreground mt-1">Em execução agora</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Concluídas</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-500">{summary.totalCompleted}</div>
            <p className="text-xs text-muted-foreground mt-1">Finalizadas com sucesso</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Conclusão</CardTitle>
            <AlertTriangle className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{summary.completionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Percentual de OS finalizadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Histórico de Operações</CardTitle>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
              <TabsList className="bg-background">
                <TabsTrigger value="daily">Diário</TabsTrigger>
                <TabsTrigger value="monthly">Mensal</TabsTrigger>
                <TabsTrigger value="annual">Anual</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="label" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "#fff" }}
                  itemStyle={{ color: "#fff" }}
                />
                <Legend
                  formatter={(value) => value === "total" ? "Total de OS" : "OS Concluídas"}
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                />
                <Line type="monotone" name="total" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" name="completed" dataKey="completed" stroke="hsl(142 70% 45%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle>Por Prioridade</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px] flex flex-col justify-center">
            <ResponsiveContainer width="100%" height="80%">
              <PieChart>
                <Pie
                  data={summary.byPriority}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="count"
                  nameKey="priority"
                >
                  {summary.byPriority.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.priority as keyof typeof PIE_COLORS] || "#888"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                  formatter={(value, name: string) => [value, PRIORITY_LABELS[name as keyof typeof PRIORITY_LABELS] || name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
              {summary.byPriority.map(p => (
                <div key={p.priority} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[p.priority as keyof typeof PIE_COLORS] }} />
                  <span className="text-muted-foreground">
                    {PRIORITY_LABELS[p.priority as keyof typeof PRIORITY_LABELS]}
                    <span className="text-foreground font-medium ml-1">({p.count})</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
