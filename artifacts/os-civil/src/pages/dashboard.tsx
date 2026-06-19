import { useGetDashboardSummary, useGetDashboardStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { ClipboardList, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { CATEGORY_LABELS, PRIORITY_LABELS, PRIORITY_COLORS } from "@/lib/constants";
import { useState } from "react";

const PIE_COLORS = {
  baixa: "hsl(142 70% 45%)",
  media: "hsl(45 93% 47%)",
  alta: "hsl(24 98% 50%)",
  urgente: "hsl(0 84% 60%)"
};

export default function Dashboard() {
  const [period, setPeriod] = useState<"daily" | "monthly" | "annual">("monthly");
  
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: stats, isLoading: loadingStats } = useGetDashboardStats({ period }, { query: { enabled: true, queryKey: ["dashboard-stats", period] } });

  if (loadingSummary || loadingStats) {
    return <div className="p-8 flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (!summary) return null;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel de Controle</h1>
          <p className="text-muted-foreground mt-1">Visão geral das operações e serviços.</p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="bg-card border border-border px-4 py-2 rounded-md">
            <span className="text-muted-foreground">Hoje:</span> <span className="font-mono font-bold text-primary ml-1">{summary.totalToday}</span>
          </div>
          <div className="bg-card border border-border px-4 py-2 rounded-md">
            <span className="text-muted-foreground">Este Mês:</span> <span className="font-mono font-bold text-primary ml-1">{summary.totalThisMonth}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Abertas</CardTitle>
            <ClipboardList className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{summary.totalOpen}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Andamento</CardTitle>
            <Clock className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-amber-500">{summary.totalInProgress}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Concluídas</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-500">{summary.totalCompleted}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Conclusão</CardTitle>
            <AlertTriangle className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{summary.completionRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

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
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="label" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Line type="monotone" name="Total" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" name="Concluídas" dataKey="completed" stroke="hsl(142 70% 45%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle>Por Prioridade</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={summary.byPriority}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="priority"
                >
                  {summary.byPriority.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.priority as keyof typeof PIE_COLORS] || '#888'} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                  formatter={(value, name: string) => [value, PRIORITY_LABELS[name as keyof typeof PRIORITY_LABELS] || name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2 text-xs">
              {summary.byPriority.map(p => (
                <div key={p.priority} className="flex items-center">
                  <div className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: PIE_COLORS[p.priority as keyof typeof PIE_COLORS] }} />
                  <span className="text-muted-foreground">{PRIORITY_LABELS[p.priority as keyof typeof PRIORITY_LABELS]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
