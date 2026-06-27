import { useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Download, Plus, Search, Printer, FileSpreadsheet, Camera } from "lucide-react";
import { 
  useListServiceOrders, 
  ServiceOrderStatus, 
  ServiceOrderPriority 
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, TIPO_LABELS, FORMATO_SERVICO_LABELS } from "@/lib/constants";
import { useUnit } from "@/contexts/unit-context";

type HoveredPhoto = { src: string; x: number; y: number } | null;

function parsePhotos(photosStr: string | null | undefined): string[] {
  if (!photosStr) return [];
  try { return JSON.parse(photosStr); } catch { return []; }
}

export default function Ordens() {
  const [, setLocation] = useLocation();
  const { unit } = useUnit();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [period, setPeriod] = useState<string>("monthly");
  const [tipo, setTipo] = useState<string>("all");
  const [formato, setFormato] = useState<string>("all");
  const [hoveredPhoto, setHoveredPhoto] = useState<HoveredPhoto>(null);

  const { data: ordens, isLoading } = useListServiceOrders(
    { 
      search: search || undefined, 
      status: status !== "all" ? status : undefined, 
      period: period !== "all" ? (period as any) : undefined,
      tipo: tipo !== "all" ? (tipo as any) : undefined,
      formatoServico: formato !== "all" ? (formato as any) : undefined,
      unidade: unit,
    } as any,
    { query: { enabled: true, queryKey: ["service-orders", search, status, period, tipo, formato, unit] } }
  );

  const formatCurrency = (val?: number) => {
    if (val == null) return "-";
    return new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(val);
  };

  const exportToExcel = () => {
    if (!ordens || ordens.length === 0) return;

    const headers = ["Número", "Título / Local", "Tipo", "Formato", "Status", "Prioridade", "Técnico", "Valor Estimado", "Data"];
    const content = [
      headers.join("\t"),
      ...ordens.map(os => [
        os.number,
        `${os.title} - ${os.location}`.replace(/\t/g, ' '),
        os.tipo ? TIPO_LABELS[os.tipo] : "-",
        os.formatoServico ? FORMATO_SERVICO_LABELS[os.formatoServico] : "-",
        STATUS_LABELS[os.status as ServiceOrderStatus] || os.status,
        PRIORITY_LABELS[os.priority as ServiceOrderPriority] || os.priority,
        (os.technicianName || "Não atribuído"),
        os.estimatedValue || 0,
        format(new Date(os.createdAt), "dd/MM/yyyy HH:mm")
      ].join("\t"))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + content], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ordens-servico-${format(new Date(), "yyyy-MM-dd")}.xls`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handlePrint = () => window.print();

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <style>{`
        @media print {
          .print-hide { display: none !important; }
          body { background: white !important; color: black !important; }
          .bg-card { border: none !important; box-shadow: none !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #ccc !important; padding: 8px !important; }
        }
      `}</style>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print-hide">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ordens de Serviço</h1>
          <p className="text-muted-foreground mt-1">Unidade: <strong>{unit}</strong> — chamados e atividades.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={handlePrint} disabled={!ordens?.length}>
            <Printer className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
          <Button variant="outline" onClick={exportToExcel} disabled={!ordens?.length}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
          <Button onClick={() => setLocation("/ordens/nova")}>
            <Plus className="w-4 h-4 mr-2" />
            Nova OS
          </Button>
        </div>
      </div>

      <Card className="p-4 bg-card border-border/50 print-hide">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar (número, título)..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de Serviço" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {Object.entries(TIPO_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={formato} onValueChange={setFormato}>
              <SelectTrigger>
                <SelectValue placeholder="Formato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Formatos</SelectItem>
                {Object.entries(FORMATO_SERVICO_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="daily">Hoje</SelectItem>
                <SelectItem value="monthly">Este Mês</SelectItem>
                <SelectItem value="annual">Este Ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Photo hover preview (portal-like fixed overlay) */}
      {hoveredPhoto && (
        <div
          style={{
            position: "fixed",
            left: hoveredPhoto.x + 14,
            top: Math.max(8, hoveredPhoto.y - 130),
            zIndex: 9999,
            pointerEvents: "none",
          }}
        >
          <img
            src={hoveredPhoto.src}
            alt="Preview"
            className="w-52 h-52 object-cover rounded-xl shadow-2xl border-2 border-border"
          />
        </div>
      )}

      <div className="border border-border/50 rounded-md bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[110px]">Data</TableHead>
              <TableHead className="w-[100px]">Número</TableHead>
              <TableHead>Título / Local</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Formato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Técnico</TableHead>
              <TableHead className="w-[70px]">Fotos</TableHead>
              <TableHead className="text-right">Valor Est.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mr-2" />
                    Carregando ordens...
                  </div>
                </TableCell>
              </TableRow>
            ) : ordens?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                  Nenhuma ordem de serviço encontrada para a unidade {unit}.
                </TableCell>
              </TableRow>
            ) : (
              ordens?.map((os) => {
                const photos = parsePhotos((os as any).photos);
                const firstPhoto = photos[0];
                return (
                  <TableRow 
                    key={os.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setLocation(`/ordens/${os.id}`)}
                  >
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(os.createdAt), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="font-mono font-medium text-primary">{os.number}</TableCell>
                    <TableCell>
                      <div className="font-medium truncate max-w-[200px]">{os.title}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">{os.location}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {os.tipo ? TIPO_LABELS[os.tipo] : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {os.formatoServico ? FORMATO_SERVICO_LABELS[os.formatoServico] : "-"}
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
                    <TableCell>
                      {firstPhoto ? (
                        <div
                          className="relative inline-block cursor-pointer"
                          onClick={e => e.stopPropagation()}
                          onMouseEnter={e => setHoveredPhoto({ src: firstPhoto, x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setHoveredPhoto(null)}
                        >
                          <img
                            src={firstPhoto}
                            alt="foto"
                            className="w-9 h-9 rounded object-cover border border-border"
                          />
                          {photos.length > 1 && (
                            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                              {photos.length}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Camera className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono text-yellow-500">
                      {formatCurrency(os.estimatedValue ?? undefined)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
