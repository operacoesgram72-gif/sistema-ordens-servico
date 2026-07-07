import { useState, useEffect, useCallback } from "react";
import { useGetDashboardIndicators } from "@workspace/api-client-react";
import { useUnit } from "@/contexts/unit-context";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, Legend,
} from "recharts";
import { ClipboardList, CheckCircle2, DollarSign, TrendingUp, Target, Calendar, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const MONTHS = [
  "Todos", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

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

  const isDiaMode = periodMode === "dia";

  const { data: indicators, isLoading } = useGetDashboardIndicators(
    (isDiaMode
      ? { year: selectedYear, unidade: unit, date: selectedDate }
      : { year: selectedYear, unidade: unit }) as any,
    {
      query: {
        enabled: true,
        queryKey: isDiaMode
          ? ["dashboard-indicators", selectedYear, unit, "dia", selectedDate]
          : ["dashboard-indicators", selectedYear, unit],
      },
    }
  );

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
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border/50">
          <CardHeader><CardTitle className="text-base">Volume Mensal de OS</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={indicators.byMonth} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                layout="vertical"
                data={indicators.byLocation.slice(0, 10)}
                margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="location" type="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={100} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Bar dataKey="count" name="OS" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

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

      {(indicators as any).byTechnician && (indicators as any).byTechnician.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader><CardTitle className="text-base">Desempenho por Técnico</CardTitle></CardHeader>
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
                  {(indicators as any).byTechnician.map((row: any) => (
                    <TableRow key={row.technician}>
                      <TableCell className="font-medium">{row.technician || "Não atribuído"}</TableCell>
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
    </div>
  );
}
