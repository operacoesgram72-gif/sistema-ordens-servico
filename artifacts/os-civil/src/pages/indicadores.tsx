import { useState } from "react";
import { useGetDashboardIndicators } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, Legend,
} from "recharts";
import { ClipboardList, CheckCircle2, DollarSign, TrendingUp } from "lucide-react";

export default function Indicadores() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const { data: indicators, isLoading } = useGetDashboardIndicators({ year: selectedYear }, {
    query: { enabled: true }
  });

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

  const totalOs = indicators.byMonth.reduce((acc, curr) => acc + curr.total, 0);
  const totalCompleted = indicators.byMonth.reduce((acc, curr) => acc + curr.completed, 0);
  const avgValue = totalOs > 0 ? indicators.totalValue / totalOs : 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Indicadores de Desempenho</h1>
          <p className="text-muted-foreground mt-1">Métricas e acompanhamento financeiro do ano selecionado.</p>
        </div>
        <div className="w-full md:w-48">
          <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o ano" />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              <div className="text-sm font-medium text-muted-foreground">Total de OS no Ano</div>
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
              <DollarSign className="w-4 h-4 text-yellow-500" />
              <div className="text-sm font-medium text-muted-foreground">Valor Total Estimado</div>
            </div>
            <div className="text-3xl font-bold font-mono text-yellow-500">{formatCurrency(indicators.totalValue)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <div className="text-sm font-medium text-muted-foreground">Valor Médio por OS</div>
            </div>
            <div className="text-3xl font-bold font-mono text-primary">{formatCurrency(avgValue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por Mês */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Volume Mensal de OS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={indicators.byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="month" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} label={{ value: "Qtd OS", angle: -90, position: "insideLeft", style: { fill: "#888", fontSize: 10 } }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} label={{ value: "R$ Est.", angle: 90, position: "insideRight", style: { fill: "#888", fontSize: 10 } }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value: any, name: string) => {
                      if (name === "estimatedValue") return [formatCurrency(value), "Valor Estimado"];
                      if (name === "total") return [value, "Total de OS"];
                      if (name === "completed") return [value, "OS Concluídas"];
                      return [value, name];
                    }}
                  />
                  <Legend
                    formatter={(value) => {
                      if (value === "total") return "Total de OS";
                      if (value === "completed") return "OS Concluídas";
                      if (value === "estimatedValue") return "Valor Estimado (R$)";
                      return value;
                    }}
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    iconSize={12}
                  />
                  <Bar yAxisId="left" dataKey="total" name="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="completed" name="completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="estimatedValue" name="estimatedValue" stroke="#eab308" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top 10 Locais */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Top 10 Locais com Mais OS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={indicators.byLocation} layout="vertical" margin={{ left: 50, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} vertical={true} />
                  <XAxis type="number" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} label={{ value: "Qtd de OS", position: "insideBottom", offset: -5, style: { fill: "#888", fontSize: 10 } }} />
                  <YAxis type="category" dataKey="location" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} width={50} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value: any) => [value, "Total de OS"]}
                  />
                  <Legend formatter={() => "Quantidade de OS"} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconSize={12} />
                  <Bar dataKey="total" name="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por Formato */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Projeção por Especialidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={indicators.byFormatoServico}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="formato" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                    formatter={(value: any) => [formatCurrency(value), "Valor Estimado"]}
                  />
                  <Legend formatter={() => "Valor Estimado (R$)"} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconSize={12} />
                  <Bar dataKey="estimatedValue" name="estimatedValue" fill="#eab308" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="border border-border/50 rounded-md bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Especialidade</TableHead>
                    <TableHead className="text-center">Qtd OS</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Média/OS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {indicators.byFormatoServico.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium capitalize">{f.formato}</TableCell>
                      <TableCell className="text-center">{f.total}</TableCell>
                      <TableCell className="text-right text-yellow-500">{formatCurrency(f.estimatedValue)}</TableCell>
                      <TableCell className="text-right text-primary">{formatCurrency(f.avgValuePerService)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground italic">
              * Referência: Civil R$280 | Refrigeração R$350 | Hidráulica R$250 | Mecânica R$320 | Elétrica R$290 | Outros R$180 por OS.
            </p>
          </CardContent>
        </Card>

        {/* Por Técnico */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Desempenho por Técnico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border border-border/50 rounded-md bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Técnico</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Concluídas</TableHead>
                    <TableHead className="text-center">Taxa</TableHead>
                    <TableHead className="text-right">Valor Est.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {indicators.byTechnician.map((t, i) => {
                    const rate = t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{t.technicianName || "Não atribuído"}</TableCell>
                        <TableCell className="text-center">{t.total}</TableCell>
                        <TableCell className="text-center text-emerald-500">{t.completed}</TableCell>
                        <TableCell className="text-center">
                          <span className={rate >= 70 ? "text-emerald-500" : rate >= 40 ? "text-yellow-500" : "text-red-500"}>
                            {rate}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-yellow-500">{formatCurrency(t.estimatedValue)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
