import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, Plus, Search, Filter, ArrowUpDown } from "lucide-react";
import { 
  useListServiceOrders, 
  ServiceOrderStatus, 
  ServiceOrderCategory, 
  ServiceOrderPriority 
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_LABELS, STATUS_COLORS, CATEGORY_LABELS, PRIORITY_LABELS, PRIORITY_COLORS } from "@/lib/constants";

export default function Ordens() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [period, setPeriod] = useState<"daily" | "monthly" | "annual">("monthly");

  const { data: ordens, isLoading } = useListServiceOrders(
    { search: search || undefined, status: status !== "all" ? status : undefined, period },
    { query: { enabled: true, queryKey: ["service-orders", search, status, period] } }
  );

  const exportToCSV = () => {
    if (!ordens || ordens.length === 0) return;

    const headers = ["Número", "Título", "Categoria", "Prioridade", "Status", "Técnico", "Criado Em"];
    const csvContent = [
      headers.join(";"),
      ...ordens.map(os => [
        os.number,
        `"${os.title.replace(/"/g, '""')}"`,
        CATEGORY_LABELS[os.category as ServiceOrderCategory] || os.category,
        PRIORITY_LABELS[os.priority as ServiceOrderPriority] || os.priority,
        STATUS_LABELS[os.status as ServiceOrderStatus] || os.status,
        `"${(os.technicianName || "Não atribuído").replace(/"/g, '""')}"`,
        format(new Date(os.createdAt), "dd/MM/yyyy HH:mm")
      ].join(";"))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ordens-servico-${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ordens de Serviço</h1>
          <p className="text-muted-foreground mt-1">Gerenciamento completo das atividades e chamados.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={exportToCSV} disabled={!ordens?.length}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          <Button onClick={() => setLocation("/ordens/nova")}>
            <Plus className="w-4 h-4 mr-2" />
            Nova OS
          </Button>
        </div>
      </div>

      <Card className="p-4 bg-card border-border/50">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por número, título ou local..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="w-full md:w-48">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-48">
            <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Hoje</SelectItem>
                <SelectItem value="monthly">Este Mês</SelectItem>
                <SelectItem value="annual">Este Ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="border border-border/50 rounded-md bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[120px]">Número</TableHead>
              <TableHead>Título / Local</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Técnico</TableHead>
              <TableHead className="text-right">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mr-2" />
                    Carregando ordens...
                  </div>
                </TableCell>
              </TableRow>
            ) : ordens?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  Nenhuma ordem de serviço encontrada.
                </TableCell>
              </TableRow>
            ) : (
              ordens?.map((os) => (
                <TableRow 
                  key={os.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setLocation(`/ordens/${os.id}`)}
                >
                  <TableCell className="font-mono font-medium text-primary">{os.number}</TableCell>
                  <TableCell>
                    <div className="font-medium">{os.title}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px] md:max-w-xs">{os.location}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[os.status as ServiceOrderStatus]}>
                      {STATUS_LABELS[os.status as ServiceOrderStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={PRIORITY_COLORS[os.priority as ServiceOrderPriority]}>
                      {PRIORITY_LABELS[os.priority as ServiceOrderPriority]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {os.technicianName || <span className="text-muted-foreground italic">Não atribuído</span>}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {format(new Date(os.createdAt), "dd/MM/yyyy")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
